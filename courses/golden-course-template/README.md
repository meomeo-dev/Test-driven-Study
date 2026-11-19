# 黄金标准课程模板

`golden-course-template@1.1.0` 是可安装的 v2 课程模板。「题型展示」单元
（`extended-practice`）包含 15 道题，覆盖全部 9 类题型，并以车间交班为主题演示
知识图谱、学习路径和按知识点练习。

## 学习路径示例

- [课程声明](course.json)在 `units[].concepts` 中定义 5 个知识点，并将它们关联到
  [车间交班英语指南](lessons/workplace-handover.md)。
- 「读懂车间通知」要求先完成「车间数字与数量」和「交班指令与用语」。同一个
  `prerequisites[].all_of` 中的先修知识点需要全部满足（AND）。
- 「交班复述（自评）」可以从「读懂车间通知」或「撰写交班信息」进入。多个
  `prerequisites` 组满足其中一组即可（OR）。复述完成后由学习者按指南自评。
- [题型展示题库](questions/extended-practice.json)通过题目级 `concepts` 关联练习。
  车间通知阅读题同时关联「交班指令与用语」和「读懂车间通知」。

安装后，打开「黄金标准课程模板」，从侧栏进入「学习路径」。选择「读懂车间通知」
生成计划，可看到两个先修步骤，并从任一步进入相应的练习或指南。

```sh
npm run course:check -- courses/golden-course-template
npm run course:install -- courses/golden-course-template
```

- [知识图谱与学习路径规范](../../docs/features/learning-path/README.md)
- [v2 题型说明](../../docs/features/question-types/README.md)
- [原 Step-up English 课程大纲草案](../../docs/research/step-up-english-1/syllabus_180h.json)
