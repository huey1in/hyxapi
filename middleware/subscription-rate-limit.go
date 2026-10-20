/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

// subscription-rate-limit.go — 订阅级 RPM 与 并发限制辅助函数
//
// 这些函数被 Distribute() 中间件直接调用，不作为独立 middleware 使用，
// 因为并发名额需要在 c.Next() 之后释放，与 Distribute 的请求生命周期天然耦合。
//
// 0 = 不限。

package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// checkSubscriptionRPM 检查订阅 RPM；超限时 abort 并返回 false
func checkSubscriptionRPM(c *gin.Context, subId int, rpm int) bool {
	if common.RedisEnabled {
		return checkSubscriptionRPMRedis(c, subId, rpm)
	}
	return checkSubscriptionRPMMemory(c, subId, rpm)
}

func checkSubscriptionRPMRedis(c *gin.Context, subId int, rpm int) bool {
	ctx := context.Background()
	rdb := common.RDB
	key := fmt.Sprintf("sub_rpm:%d", subId)
	length, err := rdb.LLen(ctx, key).Result()
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return false
	}
	if length < int64(rpm) {
		rdb.LPush(ctx, key, time.Now().UTC().Format(modelRateLimitTimeFormat))
		rdb.Expire(ctx, key, 2*time.Minute)
		return true
	}
	oldStr, _ := rdb.LIndex(ctx, key, -1).Result()
	oldT, err := time.Parse(modelRateLimitTimeFormat, oldStr)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return false
	}
	if int64(time.Since(oldT).Seconds()) < 60 {
		c.AbortWithStatus(http.StatusTooManyRequests)
		return false
	}
	rdb.LPush(ctx, key, time.Now().UTC().Format(modelRateLimitTimeFormat))
	rdb.LTrim(ctx, key, 0, int64(rpm-1))
	rdb.Expire(ctx, key, 2*time.Minute)
	return true
}

func checkSubscriptionRPMMemory(c *gin.Context, subId int, rpm int) bool {
	key := "sub_rpm:" + strconv.Itoa(subId)
	if !inMemoryRateLimiter.Request(key, rpm, 60) {
		c.AbortWithStatus(http.StatusTooManyRequests)
		return false
	}
	return true
}

// acquireSubscriptionConcurrent 获取并发名额；返回 (release 函数, ok)
func acquireSubscriptionConcurrent(c *gin.Context, subId int, limit int) (func(), bool) {
	if common.RedisEnabled {
		return acquireSubscriptionConcurrentRedis(c, subId, limit)
	}
	return acquireSubscriptionConcurrentMemory(c, subId, limit)
}

func acquireSubscriptionConcurrentRedis(c *gin.Context, subId int, limit int) (func(), bool) {
	ctx := context.Background()
	rdb := common.RDB
	key := fmt.Sprintf("sub_conc:%d", subId)
	n, err := rdb.Incr(ctx, key).Result()
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return nil, false
	}
	// 防止泄漏
	rdb.Expire(ctx, key, 10*time.Minute)
	if n > int64(limit) {
		rdb.Decr(ctx, key)
		c.AbortWithStatus(http.StatusTooManyRequests)
		return nil, false
	}
	released := false
	release := func() {
		if released {
			return
		}
		released = true
		rdb.Decr(ctx, key)
	}
	return release, true
}

// 内存并发计数器（单实例部署用）
var subscriptionConcurrencyMap = make(map[int]int)
var subscriptionConcurrencyMu = make(chan struct{}, 1)

func init() {
	subscriptionConcurrencyMu <- struct{}{}
}

func acquireSubscriptionConcurrentMemory(c *gin.Context, subId int, limit int) (func(), bool) {
	<-subscriptionConcurrencyMu
	current := subscriptionConcurrencyMap[subId]
	if current >= limit {
		subscriptionConcurrencyMu <- struct{}{}
		c.AbortWithStatus(http.StatusTooManyRequests)
		return nil, false
	}
	subscriptionConcurrencyMap[subId] = current + 1
	subscriptionConcurrencyMu <- struct{}{}
	released := false
	release := func() {
		if released {
			return
		}
		released = true
		<-subscriptionConcurrencyMu
		if subscriptionConcurrencyMap[subId] > 0 {
			subscriptionConcurrencyMap[subId]--
		}
		subscriptionConcurrencyMu <- struct{}{}
	}
	return release, true
}
