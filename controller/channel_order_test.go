package controller

import (
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestChannelStatusFiltersDistinguishManualAndAutomaticDisable(t *testing.T) {
	db := setupRelayIntegrationDB(t)
	tag := "status-fixture"
	channels := []model.Channel{
		{Name: "status-enabled", Type: 1, Status: 1, Group: "default", Tag: &tag},
		{Name: "status-manual", Type: 1, Status: 2, Group: "default", Tag: &tag},
		{Name: "status-auto", Type: 1, Status: 3, Group: "default", Tag: &tag},
	}
	require.NoError(t, db.Create(&channels).Error)
	for _, filter := range []struct {
		value    string
		statuses []int
	}{{"1", []int{1}}, {"2", []int{2}}, {"3", []int{3}}, {"0", []int{2, 3}}, {"disabled", []int{2, 3}}} {
		for _, path := range []string{"/api/channel/?", "/api/channel/?tag_mode=true&", "/api/channel/search?keyword=status-&", "/api/channel/search?keyword=status-&tag_mode=true&"} {
			t.Run(fmt.Sprintf("%sstatus=%s", path, filter.value), func(t *testing.T) {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest("GET", path+"status="+filter.value, nil)
				if ctx.Request.URL.Path == "/api/channel/search" {
					SearchChannels(ctx)
				} else {
					GetAllChannels(ctx)
				}
				var response struct {
					Success bool `json:"success"`
					Data    struct {
						Items []model.Channel `json:"items"`
					} `json:"data"`
				}
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
				require.True(t, response.Success, recorder.Body.String())
				var statuses []int
				for _, channel := range response.Data.Items {
					statuses = append(statuses, channel.Status)
				}
				require.ElementsMatch(t, filter.statuses, statuses)
			})
		}
	}
}

func TestChannelListFiltersTagsBeforePaginationAndSortsSafely(t *testing.T) {
	db := setupRelayIntegrationDB(t)
	tagA, tagB := "a-hidden", "b-selected"
	channels := []model.Channel{
		{Name: "Hidden", Group: "other", Type: 1, Tag: &tagA, Status: 1},
		{Name: "Zulu", Group: "team_%!", Type: 1, Tag: &tagB, Status: 1},
		{Name: "Alpha", Group: "default,team_%!", Type: 1, Tag: &tagB, Status: 1},
		{Name: "Wildcard decoy", Group: "team_123!", Type: 1, Tag: &tagA, Status: 1},
		{Name: "Disabled", Group: "team_%!", Type: 1, Tag: &tagA, Status: 2},
	}
	require.NoError(t, db.Create(&channels).Error)
	for _, request := range []struct {
		path  string
		names []string
		total int
	}{
		{"/api/channel/?group=team_%25%21&sort_by=name&sort_order=asc", []string{"Alpha", "Disabled", "Zulu"}, 3},
		{"/api/channel/?group=team_%25%21&tag_mode=true&status=1&page_size=1&sort_by=name&sort_order=asc", []string{"Alpha", "Zulu"}, 1},
		{"/api/channel/search?keyword=&group=team_%25%21&sort_by=name&sort_order=asc&status=1", []string{"Alpha", "Zulu"}, 2},
	} {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest("GET", request.path, nil)
		if ctx.Request.URL.Path == "/api/channel/search" {
			SearchChannels(ctx)
		} else {
			GetAllChannels(ctx)
		}
		var response struct {
			Success bool `json:"success"`
			Data    struct {
				Items []model.Channel `json:"items"`
				Total int             `json:"total"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.True(t, response.Success, recorder.Body.String())
		require.Equal(t, request.total, response.Data.Total, request.path)
		var names []string
		for _, channel := range response.Data.Items {
			names = append(names, channel.Name)
			require.Empty(t, channel.Key)
		}
		require.Equal(t, request.names, names, request.path)
	}
}

func TestChannelSearchPaginatesWholeTags(t *testing.T) {
	db := setupRelayIntegrationDB(t)
	tagA, tagB := "search-tag-a", "search-tag-b"
	channels := make([]model.Channel, 0, 25)
	for index := 0; index < 25; index++ {
		tag := &tagA
		if index >= 23 {
			tag = &tagB
		}
		channels = append(channels, model.Channel{Name: fmt.Sprintf("group-search-%02d", index), Type: 1, Status: 1, Group: "default", Tag: tag})
	}
	require.NoError(t, db.Create(&channels).Error)
	for _, page := range []struct {
		number, count int
		tag           string
	}{{1, 23, tagA}, {2, 2, tagB}, {3, 0, ""}} {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest("GET", fmt.Sprintf("/api/channel/search?keyword=group-search&tag_mode=true&page_size=1&p=%d&sort_by=name&sort_order=asc", page.number), nil)
		SearchChannels(ctx)
		var response struct {
			Success bool `json:"success"`
			Data    struct {
				Items []model.Channel `json:"items"`
				Total int             `json:"total"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.True(t, response.Success, recorder.Body.String())
		require.Equal(t, 2, response.Data.Total)
		require.Len(t, response.Data.Items, page.count)
		for _, channel := range response.Data.Items {
			require.Equal(t, page.tag, *channel.Tag)
			require.Empty(t, channel.Key)
		}
	}
}

func TestChannelDefaultBaseURLsExposeOnlyNonemptyBuiltInAddresses(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("GET", "/api/channel/default_base_urls", nil)
	GetChannelDefaultBaseURLs(ctx)
	var response struct {
		Success bool           `json:"success"`
		Data    map[int]string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, constant.ChannelBaseURLs[constant.ChannelTypeOpenAI], response.Data[constant.ChannelTypeOpenAI])
	for _, address := range response.Data {
		require.NotEmpty(t, address)
	}
}
