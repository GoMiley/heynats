package infrastructure

import (
	"strings"
	"testing"
	"testing/fstest"
)

func TestIndexInjectionFindsHeadWithAttributes(t *testing.T) {
	dist := fstest.MapFS{"index.html": {Data: []byte(`<!doctype html><html><HEAD lang="en"><title>x</title></HEAD><body></body></html>`)}}
	got := string(indexWithConfig(dist, UIConfig{BasePath: "/nats", ReadOnly: true}))
	want := `<HEAD lang="en"><base href="/nats/"><script>window.__HEYNATS__={"basePath":"/nats","readOnly":true,"liveTap":false}</script><title>`
	if !strings.Contains(got, want) {
		t.Errorf("index = %s\nwant it to contain %s", got, want)
	}
}

func TestIndexInjectionWithoutHeadFailsLoudly(t *testing.T) {
	dist := fstest.MapFS{"index.html": {Data: []byte(`<html><body>no head</body></html>`)}}
	got := string(indexWithConfig(dist, UIConfig{BasePath: "/nats"}))
	if strings.Contains(got, "no head") || !strings.Contains(got, "no &lt;head&gt;") {
		t.Errorf("index without <head> = %s, want the error page", got)
	}
}
