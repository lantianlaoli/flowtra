# Google URL Removal Execution Plan

## 执行进度

- ✅ **第 1 天 (2025-12-22)**: 103 个 URL 已成功提交
- 📅 **第 2 天**: 103 个 URL 待提交
- 📅 **第 3 天**: 103 个 URL 待提交
- 📅 **第 4 天**: 101 个 URL 待提交
- 📅 **第 5 天**: 39 个 URL 待提交

**总计**: 449 个 URL

---

## 每日执行命令

### 第 2 天
```bash
bash -c 'set -a; source .env; set +a; node remove-urls-script.js google-removal-day2.json'
```

### 第 3 天
```bash
bash -c 'set -a; source .env; set +a; node remove-urls-script.js google-removal-day3.json'
```

### 第 4 天
```bash
bash -c 'set -a; source .env; set +a; node remove-urls-script.js google-removal-day4.json'
```

### 第 5 天
```bash
bash -c 'set -a; source .env; set +a; node remove-urls-script.js google-removal-day5.json'
```

---

## 执行后检查

每次执行完成后，会自动生成结果文件：
- `google-removal-day2-result.json`
- `google-removal-day3-result.json`
- `google-removal-day4-result.json`
- `google-removal-day5-result.json`

检查成功/失败数量：
```bash
cat google-removal-day2-result.json | grep -E '"successful"|"failed"|"total"'
```

---

## 注意事项

1. **每日配额**: Google Indexing API 限制为 103 请求/天
2. **执行间隔**: 每次请求之间有 200ms 延迟
3. **预计耗时**: 每批次约 20-25 秒
4. **错误处理**: 如遇配额错误，说明当天配额已用完，等待第二天继续

---

## 批次文件说明

### google-removal-day2.json (103 个)
- 批次 1 失败的 97 个 URL
- 批次 2 的前 6 个 URL

### google-removal-day3.json (103 个)
- 批次 2 的 URL (索引 6-108)

### google-removal-day4.json (101 个)
- 批次 2 的剩余 93 个 URL (索引 109-199)
- 批次 3 的前 8 个 URL (索引 0-7)

### google-removal-day5.json (39 个)
- 批次 3 的剩余 41 个 URL (索引 8-48)

---

## Google Search Console 监控

完成所有提交后，访问 https://search.google.com/search-console 监控移除状态：
- **Pending**: 正在处理
- **Removed**: 临时移除 (24-48 小时)
- **Permanent**: 永久移除 (3-6 个月后重新爬取确认 404)
