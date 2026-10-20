package api

import (
	"net/http"
	"time"

	"github.com/astergaze-solutions/heynats/internal/pkg"
	"github.com/gin-gonic/gin"
)

type HeyNats struct {
	router     *gin.RouterGroup
	conns      *NatsConnectionStore
	middleware *ConnectionMiddleware
}

func NewHeyNats(
	r *gin.RouterGroup,
	conns *NatsConnectionStore,
	middleware *ConnectionMiddleware,
) *HeyNats {
	return &HeyNats{
		router:     r,
		conns:      conns,
		middleware: middleware,
	}
}

func (e *HeyNats) RegisterRoutes() {
	// NATS connection endpoints
	api := e.router
	// No connect, test or disconnect endpoints: the server's one connection
	// comes from its environment, and the browser can never choose a host or
	// credentials.

	api.GET("/info", e.middleware.RequireConnection(), func(c *gin.Context) {
		natsConn, exists := c.Get(NatsConnectionKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":     "Not connected to NATS server",
				"connected": false,
			})
			return
		}

		conn := natsConn.(*pkg.NATSCredential)
		info, err := conn.GetInfo()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get NATS server info",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, info)
	})

	api.GET("/connection/stats", e.middleware.RequireConnection(), func(c *gin.Context) {
		connectionID, exists := c.Get(ConnectionIDKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Connection ID not found",
			})
			return
		}

		cID, ok := connectionID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid connection ID format",
			})
			return
		}

		// Get connection info
		e.conns.mutex.RLock()
		connInfo, exists := e.conns.nastsConns[cID]
		e.conns.mutex.RUnlock()

		if !exists {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Connection not found",
			})
			return
		}

		stats := gin.H{
			"connection_id":  cID,
			"last_activity":  connInfo.LastActivity,
			"idle_timeout":   e.conns.idleTimeout,
			"time_remaining": e.conns.idleTimeout - time.Since(connInfo.LastActivity),
			"is_healthy":     connInfo.Connection.IsHealthy(),
			"is_connected":   connInfo.Connection.Conn != nil && connInfo.Connection.Conn.IsConnected(),
		}

		c.JSON(http.StatusOK, stats)
	})

	api.GET("/account/info", e.middleware.RequireConnection(), func(c *gin.Context) {
		natsConn, exists := c.Get(NatsConnectionKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":     "Not connected to NATS server",
				"connected": false,
			})
			return
		}

		conn := natsConn.(*pkg.NATSCredential)
		accountInfo, err := conn.GetAccountInfo()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get account information",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, accountInfo)
	})

	api.GET("/account", e.middleware.RequireConnection(), func(c *gin.Context) {
		natsConn, exists := c.Get(NatsConnectionKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":     "Not connected to NATS server",
				"connected": false,
			})
			return
		}

		conn := natsConn.(*pkg.NATSCredential)
		accountInfo, err := conn.GetAccountInfo()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get account information",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, accountInfo)
	})

	api.GET("/status", e.middleware.Handle(), func(c *gin.Context) {
		natsConn, exists := c.Get(NatsConnectionKey)
		connected := false
		status := gin.H{
			"connected": connected,
		}

		if exists {
			conn := natsConn.(*pkg.NATSCredential)
			connected = conn != nil && conn.Conn != nil && conn.Conn.IsConnected()
			status["connected"] = connected

			if connected {
				status["server_name"] = conn.Conn.ConnectedServerName()
				status["url"] = conn.Conn.ConnectedUrlRedacted()
				status["username"] = conn.Username
			}
		}

		c.JSON(http.StatusOK, status)
	})

	api.GET("/health", e.middleware.Handle(), func(c *gin.Context) {
		natsConn, exists := c.Get(NatsConnectionKey)
		if !exists {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":    "unhealthy",
				"connected": false,
			})
			return
		}

		conn := natsConn.(*pkg.NATSCredential)
		if conn == nil || conn.Conn == nil || !conn.Conn.IsConnected() {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":    "unhealthy",
				"connected": false,
			})
			return
		}

		// Perform a ping to check health
		if err := conn.Conn.Flush(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":    "unhealthy",
				"connected": false,
				"error":     err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"connected": true,
		})
	})

}
