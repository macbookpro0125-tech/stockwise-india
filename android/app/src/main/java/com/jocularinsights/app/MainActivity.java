package com.jocularinsights.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // The launch logo stays, drawn here over the page, until the page's opening
    // is drawn and ready to run (1 Nov 2026, seen by filming the app: 1.5 s of
    // empty screen, and the line half gone before it showed). A view, not the
    // system's splash hold, because that stops the page drawing behind it.
    // No answer, no connection or an old page: it goes after a few seconds anyway.
    private static final long LONGEST_MS = 6000;
    private View cover;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // no fade of the system's own: the same logo is underneath
        SplashScreen.installSplashScreen(this).setOnExitAnimationListener(view -> view.remove());
        super.onCreate(savedInstanceState);
        int icon = Math.round(288 * getResources().getDisplayMetrics().density);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher_foreground);
        FrameLayout layer = new FrameLayout(this);
        layer.setBackgroundColor(ContextCompat.getColor(this, R.color.app_background));
        layer.setClickable(true);
        layer.addView(logo, new FrameLayout.LayoutParams(icon, icon, Gravity.CENTER));
        addContentView(layer, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        cover = layer;
        new Handler(Looper.getMainLooper()).postDelayed(this::uncover, LONGEST_MS);
        getBridge().getWebView().addJavascriptInterface(this, "JocularApp");
    }

    private void uncover() {
        View layer = cover;
        cover = null;
        if (layer != null) layer.animate().alpha(0f).setDuration(200).withEndAction(() -> ((ViewGroup) layer.getParent()).removeView(layer));
    }

    @JavascriptInterface
    public void pageReady() {
        runOnUiThread(this::uncover);
    }
}
