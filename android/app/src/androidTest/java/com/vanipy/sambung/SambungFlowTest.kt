package com.vanipy.sambung

import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class SambungFlowTest {

    @get:Rule
    val rule = ActivityScenarioRule(MainActivity::class.java)

    private fun evalJs(js: String): String {
        val latch = CountDownLatch(1)
        var result = "null"
        rule.scenario.onActivity { activity ->
            activity.runOnUiThread {
                activity.webView.evaluateJavascript(js) { v ->
                    result = v ?: "null"
                    latch.countDown()
                }
            }
        }
        latch.await(15, TimeUnit.SECONDS)
        return result
    }

    private fun awaitPage() {
        var title = ""
        for (i in 1..20) {
            title = evalJs("document.title")
            if (title.contains("sambung")) break
            Thread.sleep(500)
        }
        assertTrue("page title did not load, got: $title", title.contains("sambung"))
    }

    @Test
    fun fullHandoffFlowOnRealWebView() {
        // 1. The bundled web app + SDK load on a real Android WebView.
        awaitPage()

        // 2. The native bridge is present.
        assertTrue(
            "SambungBridge missing",
            evalJs("typeof window.SambungBridge") == "\"object\""
        )

        // 3. Typing a request builds a brief (default template: list of items).
        evalJs("""
            const t = document.getElementById('task');
            t.value = 'suggest two names for a rainy playlist';
            t.dispatchEvent(new Event('input'));
            'done'
        """)
        val brief = evalJs("document.getElementById('brief').value")
        assertTrue("brief missing request, got: $brief", brief.contains("rainy playlist"))
        assertTrue("brief missing reply rules", brief.contains("How to reply"))

        // 4. A valid reply passes the check and previews the parsed result.
        evalJs("""
            document.getElementById('reply').value = '{"items": ["monsoon", "drizzle"]}';
            document.getElementById('checkReply').click();
            'done'
        """)
        Thread.sleep(300)
        val statusClass = evalJs("document.getElementById('status').className")
        assertTrue("expected ok status, got: $statusClass", statusClass.contains("ok"))
        val result = evalJs("document.getElementById('result').value")
        assertTrue("result missing items, got: $result",
            result.contains("monsoon") && result.contains("drizzle"))
        val resultVisible = evalJs(
            "!document.getElementById('resultBlock').classList.contains('hidden')")
        assertTrue("result block not shown", resultVisible == "true")

        // 5. An off-shape reply is refused and nothing is presented as usable.
        evalJs("""
            document.getElementById('reply').value = '{"items": [], "extra": 1}';
            document.getElementById('checkReply').click();
            'done'
        """)
        Thread.sleep(300)
        val errClass = evalJs("document.getElementById('status').className")
        assertTrue("expected err status, got: $errClass", errClass.contains("err"))
        val errText = evalJs("document.getElementById('status').textContent")
        assertTrue("error should name the unknown field, got: $errText",
            errText.contains("unknown field"))
        val stillHidden = evalJs(
            "document.getElementById('resultBlock').classList.contains('hidden')")
        assertTrue("result must stay hidden after a failed check", stillHidden == "true")

        // 6. The passed exchange was stored in local history on the device.
        val history = evalJs("localStorage.getItem('sambung.history.v1') || '[]'")
        assertTrue("history empty after a passed check", history.contains("rainy playlist"))
    }

    @Test
    fun shareTargetPrefillsReply() {
        // An assistant app sharing text to sambung lands it in the reply box.
        val intent = Intent(ApplicationProvider.getApplicationContext(), MainActivity::class.java)
            .setAction(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, """{"items": ["shared back"]}""")
        ActivityScenario.launch<MainActivity>(intent).use { scenario ->
            val latch = CountDownLatch(1)
            var value = ""
            for (i in 1..30) {
                scenario.onActivity { activity ->
                    activity.runOnUiThread {
                        activity.webView.evaluateJavascript(
                            "document.getElementById('reply') ? document.getElementById('reply').value : ''"
                        ) { v ->
                            value = v ?: ""
                            latch.countDown()
                        }
                    }
                }
                latch.await(15, TimeUnit.SECONDS)
                if (value.contains("shared back")) break
                Thread.sleep(500)
            }
            assertTrue("shared text did not reach the reply box, got: $value",
                value.contains("shared back"))
        }
    }
}
