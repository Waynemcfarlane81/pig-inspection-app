package tech.holderness.piginspection;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Watches the phone's location during an inspection and logs the moment it leaves the farm
 * (more than `radius` metres from the farm location). Runs as a foreground service with a
 * notification, so it keeps working when the screen is off or the app is in the background.
 * Stops itself on leaving, or at the deadline (2 hours after the inspection started).
 * The result is kept in SharedPreferences "geofence" and read by FarmPlugin.geofenceStatus().
 */
public class GeofenceService extends Service implements LocationListener {
    static final String PREFS = "geofence";
    static final String CHANNEL = "inspection";
    static final int NOTE_RUNNING = 41, NOTE_LEFT = 42;

    private LocationManager lm;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeUp = this::finish;
    private double lat, lng;
    private float radius;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void start(Context ctx, double lat, double lng, float radius, long startedAt, long deadline) {
        prefs(ctx).edit()
                .putBoolean("active", true)
                .putLong("lat", Double.doubleToRawLongBits(lat))
                .putLong("lng", Double.doubleToRawLongBits(lng))
                .putFloat("radius", radius)
                .putLong("startedAt", startedAt)
                .putLong("deadline", deadline)
                .putLong("exitedAt", 0)
                .putFloat("lastDist", -1)
                .putLong("lastAt", 0)
                .apply();
        ContextCompat.startForegroundService(ctx, new Intent(ctx, GeofenceService.class));
    }

    static void stop(Context ctx) {
        prefs(ctx).edit().putBoolean("active", false).apply();
        ctx.stopService(new Intent(ctx, GeofenceService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences p = prefs(this);
        long deadline = p.getLong("deadline", 0);
        if (!p.getBoolean("active", false) || System.currentTimeMillis() >= deadline) {
            finish();
            return START_NOT_STICKY;
        }
        lat = Double.longBitsToDouble(p.getLong("lat", 0));
        lng = Double.longBitsToDouble(p.getLong("lng", 0));
        radius = p.getFloat("radius", 500);
        channel();
        try {
            ServiceCompat.startForeground(this, NOTE_RUNNING, running(),
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
        } catch (Exception e) {
            // Not allowed to start (e.g. no location permission) – the 2-hour rule still sends the report
            p.edit().putBoolean("active", false).apply();
            stopSelf();
            return START_NOT_STICKY;
        }
        listen();
        handler.removeCallbacks(timeUp);
        handler.postDelayed(timeUp, Math.max(1000, deadline - System.currentTimeMillis()));
        return START_NOT_STICKY;
    }

    private void listen() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return;
        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER))
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 20000, 10, this, Looper.getMainLooper());
        } catch (Exception ignored) { }
        try {
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 20000, 10, this, Looper.getMainLooper());
        } catch (Exception ignored) { }
    }

    @Override
    public void onLocationChanged(Location loc) {
        // Ignore stale fixes from before this inspection started
        if (loc.getTime() > 0 && loc.getTime() < prefs(this).getLong("startedAt", 0) - 60000) return;
        float[] r = new float[1];
        Location.distanceBetween(lat, lng, loc.getLatitude(), loc.getLongitude(), r);
        float dist = r[0];
        long now = System.currentTimeMillis();
        SharedPreferences p = prefs(this);
        p.edit().putFloat("lastDist", dist).putLong("lastAt", now).putFloat("lastAcc", loc.getAccuracy()).apply();
        // Only count it as leaving when we're sure: the whole accuracy circle is outside the fence (accuracy capped at 100 m)
        if (dist - Math.min(loc.getAccuracy(), 100f) > radius && p.getLong("exitedAt", 0) == 0) {
            p.edit().putLong("exitedAt", now).apply();
            leftNotice(now);
            finish();
        }
    }

    @Override public void onProviderEnabled(String provider) { }
    @Override public void onProviderDisabled(String provider) { }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }

    private void finish() {
        handler.removeCallbacks(timeUp);
        if (lm != null) {
            try { lm.removeUpdates(this); } catch (Exception ignored) { }
        }
        prefs(this).edit().putBoolean("active", false).apply();
        try { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE); } catch (Exception ignored) { }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(timeUp);
        if (lm != null) {
            try { lm.removeUpdates(this); } catch (Exception ignored) { }
        }
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    private void channel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
                nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Inspection in progress", NotificationManager.IMPORTANCE_LOW));
            }
        }
    }

    private PendingIntent openApp() {
        Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (i == null) i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Notification running() {
        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Pig inspection in progress")
                .setContentText("Logging time on site. The report sends when you leave the farm.")
                .setOngoing(true)
                .setContentIntent(openApp())
                .build();
    }

    private void leftNotice(long when) {
        try {
            if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
            String t = new SimpleDateFormat("HH:mm", Locale.UK).format(new Date(when));
            Notification n = new NotificationCompat.Builder(this, CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                    .setContentTitle("Left the farm at " + t)
                    .setContentText("Open Pig Inspection to send the report.")
                    .setAutoCancel(true)
                    .setContentIntent(openApp())
                    .build();
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTE_LEFT, n);
        } catch (Exception ignored) { }
    }
}
