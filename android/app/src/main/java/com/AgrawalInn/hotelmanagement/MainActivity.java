package com.AgrawalInn.hotelmanagement;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Pre-set bypass cookie so localtunnel doesn't block requests
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        cm.setCookie("https://hotelagrawalinn.loca.lt", "bypass-tunnel-authorization=true; Path=/");
        cm.flush();

        // Intercept all GET requests to *.loca.lt and add the bypass header
        getBridge().getWebView().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                if (host != null && host.endsWith(".loca.lt")
                        && "GET".equalsIgnoreCase(request.getMethod())) {
                    WebResourceResponse res = fetchWithBypass(request);
                    if (res != null) return res;
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }

    private WebResourceResponse fetchWithBypass(WebResourceRequest request) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(request.getUrl().toString());
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);

            // Add bypass header
            conn.setRequestProperty("bypass-tunnel-authorization", "true");

            // Forward cookies from WebView cookie store
            String cookies = CookieManager.getInstance().getCookie(request.getUrl().toString());
            if (cookies != null && !cookies.isEmpty()) {
                conn.setRequestProperty("Cookie", cookies);
            }

            // Forward original request headers
            for (Map.Entry<String, String> h : request.getRequestHeaders().entrySet()) {
                if (!h.getKey().equalsIgnoreCase("cookie")) {
                    conn.setRequestProperty(h.getKey(), h.getValue());
                }
            }

            conn.connect();
            int status = conn.getResponseCode();

            // Copy Set-Cookie headers back into WebView cookie store
            List<String> setCookies = conn.getHeaderFields().get("Set-Cookie");
            if (setCookies != null) {
                CookieManager cm = CookieManager.getInstance();
                String domain = "https://" + request.getUrl().getHost();
                for (String cookie : setCookies) {
                    cm.setCookie(domain, cookie);
                }
                cm.flush();
            }

            String contentType = conn.getContentType();
            if (contentType == null) contentType = "text/html; charset=UTF-8";
            String mimeType = contentType.split(";")[0].trim();

            // Collect response headers
            Map<String, String> headers = new HashMap<>();
            for (Map.Entry<String, List<String>> entry : conn.getHeaderFields().entrySet()) {
                if (entry.getKey() != null && !entry.getValue().isEmpty()) {
                    headers.put(entry.getKey(), entry.getValue().get(0));
                }
            }

            InputStream stream = (status >= 400) ? conn.getErrorStream() : conn.getInputStream();
            if (stream == null) return null;

            return new WebResourceResponse(mimeType, "UTF-8", status,
                    status == 200 ? "OK" : "Error", headers, stream);

        } catch (Exception e) {
            if (conn != null) conn.disconnect();
            return null;
        }
    }
}
