package common

func FailTaskInfo(reason string) *TaskInfo {
	return &TaskInfo{
		Status: "FAILURE",
		Reason: reason,
	}
}
