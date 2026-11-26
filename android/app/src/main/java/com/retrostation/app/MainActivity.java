package com.retrostation.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends BridgeActivity {

    private static class SaveSession {
        final OutputStream stream;
        final Uri mediaUri;
        final String displayPath;

        SaveSession(OutputStream stream, Uri mediaUri, String displayPath) {
            this.stream = stream;
            this.mediaUri = mediaUri;
            this.displayPath = displayPath;
        }
    }

    private final Map<String, SaveSession> saveSessions = new ConcurrentHashMap<>();
    private ActivityResultLauncher<Intent> createDocLauncher;
    private String pendingPickerCallbackId;
    private String pendingPickerFileName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableImmersiveFullscreen();

        createDocLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                String cbId = pendingPickerCallbackId;
                String name = pendingPickerFileName;
                pendingPickerCallbackId = null;
                pendingPickerFileName = null;
                if (cbId == null) return;

                String payload = "CANCELLED";
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    Uri uri = result.getData().getData();
                    if (uri != null) {
                        try {
                            OutputStream os = getContentResolver().openOutputStream(uri, "w");
                            if (os != null) {
                                String sid = UUID.randomUUID().toString();
                                String display = name != null ? name : "Selected folder";
                                saveSessions.put(sid, new SaveSession(new BufferedOutputStream(os, 65536), null, display));
                                payload = sid;
                            }
                        } catch (Exception e) {
                            payload = "ERR:" + (e.getMessage() != null ? e.getMessage() : "Open failed");
                        }
                    }
                }
                final String finalCb = cbId;
                final String finalPayload = payload;
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() ->
                        getBridge().getWebView().evaluateJavascript(
                            "window.__retroFilePickerDone && window.__retroFilePickerDone(" +
                                org.json.JSONObject.quote(finalCb) + "," +
                                org.json.JSONObject.quote(finalPayload) + ")",
                            null
                        )
                    );
                }
            }
        );

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void setOrientation(String mode) {
                    runOnUiThread(() -> {
                        if ("landscape".equals(mode)) {
                            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                        } else {
                            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                        }
                        enableImmersiveFullscreen();
                    });
                }
            }, "AndroidOrientation");

            getBridge().getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public String beginDownloadsSave(String fileName, String mimeType) {
                    try {
                        String safeName = (fileName == null || fileName.trim().isEmpty()) ? "export.bin" : fileName.trim();
                        String safeMime = (mimeType == null || mimeType.trim().isEmpty()) ? "application/octet-stream" : mimeType.trim();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ContentResolver resolver = getContentResolver();
                            ContentValues values = new ContentValues();
                            values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                            values.put(MediaStore.Downloads.MIME_TYPE, safeMime);
                            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                            values.put(MediaStore.Downloads.IS_PENDING, 1);
                            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                            if (uri == null) return "ERR:Could not create file in Downloads";
                            OutputStream os = resolver.openOutputStream(uri, "w");
                            if (os == null) {
                                resolver.delete(uri, null, null);
                                return "ERR:Could not open Downloads stream";
                            }
                            String sid = UUID.randomUUID().toString();
                            saveSessions.put(sid, new SaveSession(new BufferedOutputStream(os, 65536), uri, "Downloads/" + safeName));
                            return sid;
                        } else {
                            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                            if (dir != null && !dir.exists()) dir.mkdirs();
                            File outFile = new File(dir, safeName);
                            String sid = UUID.randomUUID().toString();
                            saveSessions.put(sid, new SaveSession(new BufferedOutputStream(new FileOutputStream(outFile), 65536), null, "Downloads/" + safeName));
                            return sid;
                        }
                    } catch (Exception e) {
                        return "ERR:" + (e.getMessage() != null ? e.getMessage() : "Failed");
                    }
                }

                @JavascriptInterface
                public void pickSaveDestination(String callbackId, String fileName, String mimeType) {
                    runOnUiThread(() -> {
                        pendingPickerCallbackId = callbackId;
                        pendingPickerFileName = fileName;
                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType((mimeType == null || mimeType.isEmpty()) ? "application/octet-stream" : mimeType);
                        intent.putExtra(Intent.EXTRA_TITLE, fileName);
                        createDocLauncher.launch(intent);
                    });
                }

                @JavascriptInterface
                public String appendChunk(String sessionId, String base64Chunk) {
                    SaveSession session = saveSessions.get(sessionId);
                    if (session == null) return "ERR:Invalid session";
                    try {
                        byte[] bytes = Base64.decode(base64Chunk, Base64.DEFAULT);
                        session.stream.write(bytes);
                        return "OK";
                    } catch (Exception e) {
                        return "ERR:" + (e.getMessage() != null ? e.getMessage() : "Write failed");
                    }
                }

                @JavascriptInterface
                public String finishSave(String sessionId) {
                    SaveSession session = saveSessions.remove(sessionId);
                    if (session == null) return "ERR:Invalid session";
                    try {
                        session.stream.flush();
                        session.stream.close();
                        if (session.mediaUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ContentValues cv = new ContentValues();
                            cv.put(MediaStore.Downloads.IS_PENDING, 0);
                            getContentResolver().update(session.mediaUri, cv, null, null);
                        }
                        return "OK:" + session.displayPath;
                    } catch (Exception e) {
                        return "ERR:" + (e.getMessage() != null ? e.getMessage() : "Finalize failed");
                    }
                }

                @JavascriptInterface
                public void cancelSave(String sessionId) {
                    SaveSession session = saveSessions.remove(sessionId);
                    if (session == null) return;
                    try { session.stream.close(); } catch (Exception ignored) {}
                    if (session.mediaUri != null) {
                        try { getContentResolver().delete(session.mediaUri, null, null); } catch (Exception ignored) {}
                    }
                }
            }, "AndroidDownloads");
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        enableImmersiveFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveFullscreen();
        }
    }

    private void enableImmersiveFullscreen() {
        Window window = getWindow();
        View decorView = window.getDecorView();

        WindowCompat.setDecorFitsSystemWindows(window, false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController insetsController = window.getInsetsController();
            if (insetsController != null) {
                insetsController.hide(WindowInsets.Type.systemBars());
                insetsController.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            decorView.setSystemUiVisibility(flags);
        }

        window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
        window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
    }
}
