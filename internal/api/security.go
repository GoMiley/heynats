package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RejectCrossSite blocks state-changing requests from other websites, which
// could otherwise make this server dial any host. Other localhost ports count
// as "same-site", so those are blocked too.
func RejectCrossSite() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			return
		}
		switch c.GetHeader("Sec-Fetch-Site") {
		case "", "same-origin", "none":
			return
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Cross-site request rejected"})
	}
}

func LimitBody(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxBytes {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Request body too large"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
	}
}
