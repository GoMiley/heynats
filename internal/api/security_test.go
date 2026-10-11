package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func newGuardedRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/api", RejectCrossSite(), LimitBody(16))
	ok := func(c *gin.Context) {
		var body map[string]any
		if err := c.ShouldBindJSON(&body); err != nil {
			c.Status(http.StatusBadRequest)
			return
		}
		c.Status(http.StatusOK)
	}
	g.POST("/connect", ok)
	g.GET("/status", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r
}

func send(r http.Handler, method, body, fetchSite string) int {
	req := httptest.NewRequest(method, "/api/"+map[string]string{"POST": "connect", "GET": "status"}[method], strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if fetchSite != "" {
		req.Header.Set("Sec-Fetch-Site", fetchSite)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestRejectCrossSite(t *testing.T) {
	r := newGuardedRouter()
	tests := []struct {
		method, site string
		want         int
	}{
		{"POST", "cross-site", http.StatusForbidden},
		{"POST", "same-site", http.StatusForbidden},
		{"POST", "same-origin", http.StatusOK},
		{"POST", "none", http.StatusOK},
		{"POST", "", http.StatusOK},
		{"GET", "cross-site", http.StatusOK},
	}
	for _, tt := range tests {
		if got := send(r, tt.method, `{}`, tt.site); got != tt.want {
			t.Errorf("%s with Sec-Fetch-Site %q = %d, want %d", tt.method, tt.site, got, tt.want)
		}
	}
}

func TestLimitBody(t *testing.T) {
	r := newGuardedRouter()
	if got := send(r, "POST", `{"a":"small"}`, ""); got != http.StatusOK {
		t.Errorf("small body = %d, want 200", got)
	}
	if got := send(r, "POST", `{"a":"`+strings.Repeat("x", 100)+`"}`, ""); got != http.StatusRequestEntityTooLarge {
		t.Errorf("large body = %d, want 413", got)
	}
}
