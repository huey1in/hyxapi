package constant

type TaskPlatform string

// TaskPluginEnabled controls both embedded and uploaded task plugins.
var TaskPluginEnabled = true

const (
	TaskActionImageToVideo     = "image_to_video"
	TaskActionTextToVideo      = "text_to_video"
	TaskActionFirstTailToVideo = "first_tail_to_video"
	TaskActionReferenceToVideo = "reference_to_video"
)

func NormalizeTaskAction(action string) string {
	switch action {
	case TaskActionGenerate:
		return TaskActionImageToVideo
	case TaskActionTextGenerate:
		return TaskActionTextToVideo
	case TaskActionFirstTailGenerate:
		return TaskActionFirstTailToVideo
	case TaskActionReferenceGenerate:
		return TaskActionReferenceToVideo
	case TaskActionRemix:
		return "remix"
	default:
		return action
	}
}

const (
	TaskPlatformSuno       TaskPlatform = "suno"
	TaskPlatformMidjourney TaskPlatform = "mj"
)

const (
	TaskActionGenerate          = "generate"
	TaskActionTextGenerate      = "textGenerate"
	TaskActionFirstTailGenerate = "firstTailGenerate"
	TaskActionReferenceGenerate = "referenceGenerate"
	TaskActionRemix             = "remixGenerate"
)
