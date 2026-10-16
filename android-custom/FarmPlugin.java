package tech.holderness.piginspection;

import android.Manifest;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.provider.Settings;
import android.util.Base64;
import android.content.pm.PackageInfo;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Native helpers for the Pig Inspection app:
 *  - request(): any HTTP/WebDAV request (GET, PUT, DELETE, MKCOL, PROPFIND) to the NAS.
 *    Done natively so the browser's CORS and plain-HTTP rules don't block it.
 *  - locationStatus() / openSettings(): help the operative switch location on.
 *  - geofenceStart() / geofenceStatus() / geofenceStop(): log when the phone leaves the farm (GeofenceService).
 */
@CapacitorPlugin(name = "Farm")
public class FarmPlugin extends Plugin {

    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .build();

    @PluginMethod
    public void request(final PluginCall call) {
        final String url = call.getString("url");
        final String method = call.getString("method", "GET").toUpperCase();
        final String body = call.getString("body");
        final String bodyBase64 = call.getString("bodyBase64");
        final String contentType = call.getString("contentType", "application/octet-stream");
        final JSObject headers = call.getObject("headers", new JSObject());
        if (url == null) {
            call.reject("No URL");
            return;
        }
        new Thread(() -> {
            try {
                RequestBody rb = null;
                MediaType mt = MediaType.parse(contentType);
                if (bodyBase64 != null) {
                    rb = RequestBody.create(Base64.decode(bodyBase64, Base64.DEFAULT), mt);
                } else if (body != null) {
                    rb = RequestBody.create(body.getBytes(StandardCharsets.UTF_8), mt);
                } else if (method.equals("PUT") || method.equals("POST")) {
                    rb = RequestBody.create(new byte[0], mt);
                }
                Request.Builder b = new Request.Builder().url(url).method(method, rb);
                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    String v = headers.getString(k);
                    if (v != null) b.header(k, v);
                }
                try (Response r = client.newCall(b.build()).execute()) {
                    JSObject ret = new JSObject();
                    ret.put("status", r.code());
                    ret.put("body", r.body() != null ? r.body().string() : "");
                    call.resolve(ret);
                }
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : e.toString();
                call.reject(msg, "NETWORK");
            }
        }).start();
    }

    @PluginMethod
    public void locationStatus(PluginCall call) {
        Context ctx = getContext();
        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        boolean on = lm != null && LocationManagerCompat.isLocationEnabled(lm);
        boolean perm = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        JSObject ret = new JSObject();
        ret.put("serviceOn", on);
        ret.put("permission", perm);
        call.resolve(ret);
    }

    /** Is another app (e.g. Tailscale) installed? */
    @PluginMethod
    public void appInstalled(PluginCall call) {
        String pkg = call.getString("package", "");
        boolean installed = getContext().getPackageManager().getLaunchIntentForPackage(pkg) != null;
        JSObject ret = new JSObject();
        ret.put("installed", installed);
        call.resolve(ret);
    }

    /** Open another app, or its Play Store page if it isn't installed. */
    @PluginMethod
    public void openApp(PluginCall call) {
        String pkg = call.getString("package", "");
        boolean store = call.getBoolean("store", false);
        Context ctx = getContext();
        Intent i = store ? null : ctx.getPackageManager().getLaunchIntentForPackage(pkg);
        if (i == null) {
            i = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg));
            if (i.resolveActivity(ctx.getPackageManager()) == null) {
                i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + pkg));
            }
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String kind = call.getString("kind", "permission");
        Intent i;
        if ("service".equals(kind)) {
            i = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.fromParts("package", getContext().getPackageName(), null));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Start watching for the phone leaving the farm. lat/lng = farm centre, radius in metres, times in ms. */
    @PluginMethod
    public void geofenceStart(PluginCall call) {
        Double lat = call.getDouble("lat"), lng = call.getDouble("lng");
        if (lat == null || lng == null) { call.reject("No farm location"); return; }
        float radius = call.getFloat("radius", 500f);
        long startedAt = call.getLong("startedAt", System.currentTimeMillis());
        long deadline = call.getLong("deadline", startedAt + 2 * 3600 * 1000L);
        // Ask once to show the "left the farm" notification (Android 13+)
        if (Build.VERSION.SDK_INT >= 33 && getActivity() != null
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4711);
        }
        try {
            GeofenceService.start(getContext(), lat, lng, radius, startedAt, deadline);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : e.toString());
        }
    }

    @PluginMethod
    public void geofenceStatus(PluginCall call) {
        SharedPreferences p = GeofenceService.prefs(getContext());
        JSObject ret = new JSObject();
        ret.put("active", p.getBoolean("active", false));
        ret.put("startedAt", p.getLong("startedAt", 0));
        ret.put("deadline", p.getLong("deadline", 0));
        ret.put("exitedAt", p.getLong("exitedAt", 0));
        ret.put("lastDist", (double) p.getFloat("lastDist", -1));
        ret.put("lastAt", p.getLong("lastAt", 0));
        call.resolve(ret);
    }

    @PluginMethod
    public void geofenceStop(PluginCall call) {
        GeofenceService.stop(getContext());
        call.resolve();
    }

    /** The installed app version, e.g. 2.0.15 */
    @PluginMethod
    public void appVersion(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            ret.put("versionName", pi.versionName);
            ret.put("versionCode", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
        } catch (Exception e) {
            ret.put("versionName", "");
        }
        call.resolve(ret);
    }

    /**
     * Download a new APK and open Android's installer for it. The operative taps "Update" to finish.
     * The first time, Android asks to allow "Install unknown apps" for Pig Inspection.
     */
    @PluginMethod
    public void installUpdate(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null) { call.reject("No URL"); return; }
        final Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            JSObject ret = new JSObject();
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }
        new Thread(() -> {
            try {
                OkHttpClient dl = client.newBuilder().readTimeout(5, TimeUnit.MINUTES).build();
                File out = new File(ctx.getCacheDir(), "update.apk");
                try (Response r = dl.newCall(new Request.Builder().url(url).header("User-Agent", "PigInspection").build()).execute()) {
                    if (!r.isSuccessful() || r.body() == null) { call.reject("Download failed (" + r.code() + ")"); return; }
                    try (InputStream in = r.body().byteStream(); OutputStream os = new FileOutputStream(out)) {
                        byte[] buf = new byte[65536]; int n;
                        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                    }
                }
                Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", out);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                JSObject ret = new JSObject();
                ret.put("started", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : e.toString());
            }
        }).start();
    }
}
