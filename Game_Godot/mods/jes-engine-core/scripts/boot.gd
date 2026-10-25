## 引导场景（P0 骨架自检）
## 职责：验证 EventBus / Cfg 两个 autoload 已就绪、项目可启动。
## 后续 P1 将在这里接入主循环（对应 js/main.js 的 Game.loop）。
extends Node2D

func _ready() -> void:
	print("[Boot] XGAMe-CCG Godot 版启动")
	print("[Boot] EventBus 就绪: ", EventBus != null)
	var ok: bool = Cfg.assert_not_empty()
	print("[Boot] CFG 配置表已加载: ", ok)
	print("[Boot] P0 骨架自检完成（配置表为空属预期，等待 P2 数据迁移）")
