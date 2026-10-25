# 通道定义（规格 §4.1）
# HIT：直接命中伤害；DOT：持续伤害；AILMENT：异常状态伤害
# 与技能形态 tags（melee/projectile/...）是两个正交维度。
class_name SkillChannel
extends RefCounted

enum Channel { HIT = 1, DOT = 2, AILMENT = 4, ALL = 7 }
