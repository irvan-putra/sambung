package com.vanipy.sambung

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.util.Log
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

class MainActivity : Activity() {

    internal lateinit var webView: WebView
    private var pendingSharedText: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        this.webView = webView
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        // Serve the bundled web assets over the reserved appassets domain instead
        // of file:///android_asset, which WebView restricts for targetSdk 30+.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

            override fun onPageFinished(view: WebView, url: String) {
                deliverPendingShare()
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                Log.e("sambung", "WebView error ${error.errorCode} ${error.description} for ${request.url}")
            }
        }
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun copyText(text: String) {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("sambung", text))
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "copied", Toast.LENGTH_SHORT).show()
                }
            }

            @JavascriptInterface
            fun shareText(text: String, title: String) {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                runOnUiThread {
                    startActivity(Intent.createChooser(send, title))
                }
            }
        }, "SambungBridge")
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
        setContentView(webView)
        handleShareIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleShareIntent(intent)
    }

    private fun handleShareIntent(intent: Intent?) {
        if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (!text.isNullOrEmpty()) {
                pendingSharedText = text
                deliverPendingShare()
            }
        }
    }

    private fun deliverPendingShare() {
        val text = pendingSharedText ?: return
        if (!::webView.isInitialized) return
        // Hand the shared text to the page's reply box; JSON-quote for safety.
        val js = "window.sambungReceive && window.sambungReceive(" +
            JSONObject.quote(text) + ")"
        webView.evaluateJavascript(js) { }
        pendingSharedText = null
    }
}
