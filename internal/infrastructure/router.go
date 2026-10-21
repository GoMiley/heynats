package infrastructure

import (
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

type Router struct {
	*gin.Engine
}

// UIConfig is what the browser needs to know about this server, injected
// into index.html: where the dashboard lives and whether writes are shown.
type UIConfig struct {
	BasePath string `json:"basePath"`
	ReadOnly bool   `json:"readOnly"`
	LiveTap  bool   `json:"liveTap"`
}

// NewRouter serves the SPA from dist under ui.BasePath; unknown non-API paths
// fall back to index.html. `guard` (the login) runs on every route except
// BasePath+"/healthz", which answers "ok" and nothing else, for the load
// balancer's health check.
func NewRouter(dist fs.FS, ui UIConfig, guard gin.HandlerFunc) *Router {
	r := gin.Default()
	// KV keys may contain "/"; the client sends it as %2F.
	r.UseRawPath = true
	r.UnescapePathValues = true

	r.GET(ui.BasePath+"/healthz", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	r.Use(guard)

	index := indexWithConfig(dist, ui)
	fileServer := http.FileServer(http.FS(dist))

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if ui.BasePath != "" && path != ui.BasePath && !strings.HasPrefix(path, ui.BasePath+"/") {
			c.Status(http.StatusNotFound)
			return
		}
		rel := strings.TrimPrefix(path, ui.BasePath)
		if rel == "" {
			c.Redirect(http.StatusFound, ui.BasePath+"/")
			return
		}
		if strings.HasPrefix(rel, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API endpoint not found"})
			return
		}

		file := strings.TrimPrefix(rel, "/")
		if file == "" || file == "index.html" {
			serveIndex(c, index)
			return
		}
		if _, err := fs.Stat(dist, file); err != nil {
			serveIndex(c, index)
			return
		}
		c.Request.URL.Path = "/" + file
		fileServer.ServeHTTP(c.Writer, c.Request)
	})

	return &Router{r}
}

func serveIndex(c *gin.Context, index []byte) {
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, "text/html; charset=utf-8", index)
}

// indexWithConfig adds <base href> (relative assets resolve under the base
// path, deep links included) and window.__HEYNATS__ to the built index.html.
func indexWithConfig(dist fs.FS, ui UIConfig) []byte {
	raw, err := fs.ReadFile(dist, "index.html")
	if err != nil {
		return []byte("<!doctype html><title>HeyNATS</title><p>The client is not built.</p>")
	}
	loc := headTag.FindIndex(raw)
	if loc == nil {
		// Fail loudly: without the injection, assets and API miss the base path.
		slog.Error("index.html has no <head> tag; cannot inject the base path")
		return []byte("<!doctype html><title>HeyNATS</title><p>The client build has no &lt;head&gt;.</p>")
	}
	cfg, _ := json.Marshal(ui)
	inject := []byte(`<base href="` + ui.BasePath + `/"><script>window.__HEYNATS__=` + string(cfg) + `</script>`)
	out := make([]byte, 0, len(raw)+len(inject))
	out = append(out, raw[:loc[1]]...)
	out = append(out, inject...)
	return append(out, raw[loc[1]:]...)
}

// headTag matches the opening <head> tag, attributes and any case included.
var headTag = regexp.MustCompile(`(?i)<head(\s[^>]*)?>`)
