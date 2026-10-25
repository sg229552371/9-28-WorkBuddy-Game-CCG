extends SceneTree

## D-47 API 地图重新生成命令行入口
## 用法：Godot --headless --path . -s res://mods/jes-skills/tools/gen_api_map.gd
## 产物：docs/_AI开发与文档/03_查规则/API地图.md（勿手改，门禁比对防过期）

const OUT_PATH := "res://mods/jes-skills/docs/_AI开发与文档/03_查规则/API地图.md"

func _init() -> void:
	var text := ApiMapGenerator.generate()
	var f := FileAccess.open(OUT_PATH, FileAccess.WRITE)
	if f == null:
		push_error("gen_api_map: 无法写入 %s" % OUT_PATH)
		quit(1)
		return
	f.store_string(text)
	f.close()
	print("gen_api_map: 已写入 %s（%d 字符）" % [OUT_PATH, text.length()])
	quit(0)
