package com.retrostation.app;

import android.app.Dialog;
import android.os.Bundle;
import android.os.Message;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen awake while app is open
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Enforce immersive fullscreen and permanently hide status bar
        hideStatusBar();

        // Implement custom WebChromeClient to handle Google OAuth window.open popups
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView mainWebView = getBridge().getWebView();
                mainWebView.getSettings().setSupportMultipleWindows(true);
                mainWebView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);

                mainWebView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                    @Override
                    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                        WebView newWebView = new WebView(MainActivity.this);
                        WebSettings settings = newWebView.getSettings();
                        settings.setJavaScriptEnabled(true);
                        settings.setDomStorageEnabled(true);
                        settings.setSupportMultipleWindows(true);
                        settings.setJavaScriptCanOpenWindowsAutomatically(true);

                        // Strip '; wv' to avoid Google disallowed_useragent
                        String defaultUA = settings.getUserAgentString();
                        if (defaultUA != null) {
                            settings.setUserAgentString(defaultUA.replace("; wv", "").replace("Version/4.0 ", ""));
                        }

                        Dialog authDialog = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);
                        authDialog.setContentView(newWebView);
                        authDialog.show();

                        newWebView.setWebChromeClient(new WebChromeClient() {
                            @Override
                            public void onCloseWindow(WebView window) {
                                authDialog.dismiss();
                            }
                        });

                        newWebView.setWebViewClient(new WebViewClient());

                        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                        transport.setWebView(newWebView);
                        resultMsg.sendToTarget();
                        return true;
                    }
                });
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        hideStatusBar();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideStatusBar();
        }
    }

    private void hideStatusBar() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.statusBars());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
    }
}
