package api

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/astergaze-solutions/heynats/internal/infrastructure"
	"github.com/astergaze-solutions/heynats/internal/pkg"
	"github.com/astergaze-solutions/heynats/internal/testutil/natstest"
	"github.com/gin-gonic/gin"
)

// newDashboard wires the production router the way main.go does: fixed
// connection, login on every route, base path, read-only.
func newDashboard(t *testing.T, readOnly bool, liveTapOff ...bool) (http.Handler, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	srv := natstest.Start(t)
	store := NewFixedNatsConnection(&pkg.ConnectionRequest{Servers: []string{srv.ClientURL()}})
	t.Cleanup(store.Shutdown)

	dist := fstest.MapFS{
		"index.html":    {Data: []byte("<!doctype html><html><head><title>x</title></head><body></body></html>")},
		"assets/app.js": {Data: []byte("console.log(1)")},
	}
	r := infrastructure.NewRouter(dist, infrastructure.UIConfig{BasePath: "/nats", ReadOnly: readOnly}, BasicAuth("ops", "pw"))
	g := r.Group("/nats/api", RejectCrossSite())
	if readOnly {
		g.Use(RefuseWrites())
	}
	mw := NewConnectionMiddleware(store)
	n := g.Group("/nats")
	NewHeyNats(n, store, mw).RegisterRoutes()
	noLive := len(liveTapOff) > 0 && liveTapOff[0]
	streams := NewStreamAPI(n, store, mw)
	streams.NoLiveTap = noLive
	streams.RegisterRoutes()
	NewPublishAPI(n, store, mw).RegisterRoutes()
	if !noLive {
		NewSubscribeAPI(n, store, mw).RegisterRoutes()
	}
	return r, srv.ClientURL()
}

func call(r http.Handler, method, path string, auth bool, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if auth {
		req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte("ops:pw")))
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestLoginGuardsPagesAssetsAndAPI(t *testing.T) {
	r, _ := newDashboard(t, true)
	for _, path := range []string{"/nats/", "/nats/dashboard/streams", "/nats/assets/app.js", "/nats/api/nats/status", "/nats/api/nats/streams"} {
		if w := call(r, http.MethodGet, path, false, ""); w.Code != http.StatusUnauthorized || w.Header().Get("WWW-Authenticate") == "" {
			t.Errorf("GET %s without login = %d, want 401 with a challenge", path, w.Code)
		}
	}
	bad := httptest.NewRequest(http.MethodGet, "/nats/", nil)
	bad.SetBasicAuth("ops", "wrong")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, bad)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("wrong password = %d, want 401", w.Code)
	}
	if w := call(r, http.MethodGet, "/nats/healthz", false, ""); w.Code != http.StatusOK || w.Body.String() != "ok" {
		t.Errorf("healthz = %d %q, want 200 ok without login", w.Code, w.Body.String())
	}
}

func TestBasePathServesIndexWithConfigAndAssets(t *testing.T) {
	r, _ := newDashboard(t, true)
	w := call(r, http.MethodGet, "/nats/dashboard/streams/ORDER_EVENTS", true, "")
	if w.Code != http.StatusOK {
		t.Fatalf("deep link = %d", w.Code)
	}
	html := w.Body.String()
	if !strings.Contains(html, `<base href="/nats/">`) || !strings.Contains(html, `window.__HEYNATS__={"basePath":"/nats","readOnly":true,"liveTap":false}`) {
		t.Errorf("index.html lacks the base href or the config: %s", html)
	}
	if w := call(r, http.MethodGet, "/nats/assets/app.js", true, ""); w.Code != http.StatusOK || w.Body.String() != "console.log(1)" {
		t.Errorf("asset = %d %q", w.Code, w.Body.String())
	}
	if w := call(r, http.MethodGet, "/dashboard", true, ""); w.Code != http.StatusNotFound {
		t.Errorf("outside the base path = %d, want 404", w.Code)
	}
}

func TestBrowserCannotChooseAHost(t *testing.T) {
	r, _ := newDashboard(t, false)
	for _, path := range []string{"/nats/api/nats/connect", "/nats/api/nats/test", "/nats/api/nats/disconnect"} {
		w := call(r, http.MethodPost, path, true, `{"host":"evil.example","port":"4222"}`)
		if w.Code != http.StatusNotFound {
			t.Errorf("POST %s = %d, want 404 (no such endpoint)", path, w.Code)
		}
	}
	var status map[string]any
	w := call(r, http.MethodGet, "/nats/api/nats/status", true, "")
	_ = json.Unmarshal(w.Body.Bytes(), &status)
	if status["connected"] != true {
		t.Errorf("status = %s, want connected to the environment's NATS", w.Body.String())
	}
}

func TestReadOnlyRefusesWritesButServesReads(t *testing.T) {
	r, _ := newDashboard(t, true)
	writes := []struct{ method, path, body string }{
		{http.MethodPost, "/nats/api/nats/publish/message", `{"subject":"order.1.2.created","data":"x"}`},
		{http.MethodPost, "/nats/api/nats/streams", `{"name":"X","subjects":["x.>"]}`},
		{http.MethodDelete, "/nats/api/nats/streams/ORDER_EVENTS", ""},
		// A queue group would divert deliveries from a real subscriber.
		{http.MethodGet, "/nats/api/nats/subscribe/messages/order.%3E?queue_group=workers", ""},
	}
	for _, wr := range writes {
		w := call(r, wr.method, wr.path, true, wr.body)
		if w.Code != http.StatusForbidden || !strings.Contains(w.Body.String(), "read-only") {
			t.Errorf("%s %s = %d %s, want 403 read-only", wr.method, wr.path, w.Code, w.Body.String())
		}
	}
	if w := call(r, http.MethodGet, "/nats/api/nats/streams", true, ""); w.Code != http.StatusOK {
		t.Errorf("list streams = %d, want 200", w.Code)
	}
	_, _ = io.Discard.Write(nil)
}

func TestLiveTapOffRefusesStreamsAtOnceButServesReads(t *testing.T) {
	r, _ := newDashboard(t, true, true)
	for _, path := range []string{
		"/nats/api/nats/subscribe/messages/order.%3E",
		"/nats/api/nats/streams/ORDER_EVENTS/subjects/order.%3E/subscribe",
	} {
		if w := call(r, http.MethodGet, path, true, ""); w.Code != http.StatusNotFound {
			t.Errorf("GET %s with live tap off = %d %s, want 404 at once", path, w.Code, w.Body.String())
		}
	}
	if w := call(r, http.MethodGet, "/nats/api/nats/streams", true, ""); w.Code != http.StatusOK {
		t.Errorf("list streams with live tap off = %d, want 200", w.Code)
	}
}
