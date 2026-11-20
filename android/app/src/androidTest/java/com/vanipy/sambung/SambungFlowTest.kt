package com.vanipy.sambung

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class SambungFlowTest {

    private fun evalJs(scenario: ActivityScenario<MainActivity>, js: String): String {
        val latch = CountDownLatch(1)
        var result = "null"
        scenario.onActivity { activity ->
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

    private fun awaitPage(scenario: ActivityScenario<MainActivity>) {
        var title = ""
        for (i in 1..20) {
            title = evalJs(scenario, "document.title")
            if (title.contains("sambung")) break
            Thread.sleep(500)
        }
        assertTrue("page title did not load, got: $title", title.contains("sambung"))
    }

    private fun awaitReplyValue(
        scenario: ActivityScenario<MainActivity>,
        needle: String
    ): String {
        var value = ""
        for (i in 1..30) {
            value = evalJs(
                scenario,
                "document.getElementById('reply') ? document.getElementById('reply').value : ''"
            )
            if (value.contains(needle)) break
            Thread.sleep(500)
        }
        return value
    }

    private fun shareIntent(text: String): Intent {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        return Intent(ctx, MainActivity::class.java)
            .setAction(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, text)
    }

    @Test
    fun fullHandoffFlowOnRealWebView() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            // 1. The bundled web app + SDK load on a real Android WebView.
            awaitPage(scenario)

            // 2. The native bridge is present.
            assertTrue(
                "SambungBridge missing",
                evalJs(scenario, "typeof window.SambungBridge") == "\"object\""
            )

            // 3. Typing a request builds a brief (default template: list of items).
            evalJs(scenario, """
                const t = document.getElementById('task');
                t.value = 'suggest two names for a rainy playlist';
                t.dispatchEvent(new Event('input'));
                'done'
            """)
            val brief = evalJs(scenario, "document.getElementById('brief').value")
            assertTrue("brief missing request, got: $brief", brief.contains("rainy playlist"))
            assertTrue("brief missing reply rules", brief.contains("How to reply"))

            // 4. A valid reply passes the check and previews the parsed result.
            evalJs(scenario, """
                document.getElementById('reply').value = '{"items": ["monsoon", "drizzle"]}';
                document.getElementById('checkReply').click();
                'done'
            """)
            Thread.sleep(300)
            val statusClass = evalJs(scenario, "document.getElementById('status').className")
            assertTrue("expected ok status, got: $statusClass", statusClass.contains("ok"))
            val result = evalJs(scenario, "document.getElementById('result').value")
            assertTrue("result missing items, got: $result",
                result.contains("monsoon") && result.contains("drizzle"))
            val resultVisible = evalJs(scenario,
                "!document.getElementById('resultBlock').classList.contains('hidden')")
            assertTrue("result block not shown", resultVisible == "true")

            // 5. An off-shape reply is refused and nothing is presented as usable.
            evalJs(scenario, """
                document.getElementById('reply').value = '{"items": [], "extra": 1}';
                document.getElementById('checkReply').click();
                'done'
            """)
            Thread.sleep(300)
            val errClass = evalJs(scenario, "document.getElementById('status').className")
            assertTrue("expected err status, got: $errClass", errClass.contains("err"))
            val errText = evalJs(scenario, "document.getElementById('status').textContent")
            assertTrue("error should name the unknown field, got: $errText",
                errText.contains("unknown field"))
            val stillHidden = evalJs(scenario,
                "document.getElementById('resultBlock').classList.contains('hidden')")
            assertTrue("result must stay hidden after a failed check", stillHidden == "true")

            // 6. The passed exchange was stored in local history on the device.
            val history = evalJs(scenario, "localStorage.getItem('sambung.history.v1') || '[]'")
            assertTrue("history empty after a passed check", history.contains("rainy playlist"))
        }
    }

    @Test
    fun shareTargetPrefillsReply() {
        // Cold start: a share that lands before the page's scripts are ready
        // must still reach the reply box once they are.
        ActivityScenario.launch<MainActivity>(
            shareIntent("""{"items": ["shared back"]}""")
        ).use { scenario ->
            val first = awaitReplyValue(scenario, "shared back")
            assertTrue("shared text did not reach the reply box, got: $first",
                first.contains("shared back"))

            // Warm, repeated share while the app is already open: the newest
            // text replaces the box; nothing is dropped or duplicated.
            val ctx = ApplicationProvider.getApplicationContext<Context>()
            ctx.startActivity(
                shareIntent("""{"items": ["second share"]}""")
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
            val second = awaitReplyValue(scenario, "second share")
            assertTrue("second share did not reach the reply box, got: $second",
                second.contains("second share"))
            assertTrue("old share text should be replaced, got: $second",
                !second.contains("shared back"))
        }
    }
}
