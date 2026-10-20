package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"

	"github.com/gin-gonic/gin"
)

// BasicAuth guards every route it wraps — pages, assets and API alike — with
// one user and password from the environment. The comparison is constant
// time over digests, so neither the length nor a prefix of the secret leaks.
func BasicAuth(user, password string) gin.HandlerFunc {
	wantUser := sha256.Sum256([]byte(user))
	wantPass := sha256.Sum256([]byte(password))
	return func(c *gin.Context) {
		u, p, ok := c.Request.BasicAuth()
		gotUser := sha256.Sum256([]byte(u))
		gotPass := sha256.Sum256([]byte(p))
		userOK := subtle.ConstantTimeCompare(gotUser[:], wantUser[:])
		passOK := subtle.ConstantTimeCompare(gotPass[:], wantPass[:])
		if !ok || userOK&passOK != 1 {
			c.Header("WWW-Authenticate", `Basic realm="NATS dashboard", charset="UTF-8"`)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Next()
	}
}
