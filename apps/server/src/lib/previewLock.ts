// 风格包预览渲染锁
// 
// 根因：renderStylePreview 在应用 patches 时会临时把 patch 写入真实包路径、
// 渲染完成后 finally 恢复。若同一 pack 并发预览，会出现：
//   A 写临时包 → B 写临时包 → A 恢复（此时原包已被 B 覆盖）→ B 恢复（乱）
// 
// 修复：对同一串行化，不同 pack 之间互不阻塞。Node.js 单线程，用 promise 链即可。

const chains = new Map<string, Promise<unknown>>()

/** 串行执行：同一 key 的任务按提交顺序逐个跑，不同 key 并行无阻塞。 */
export function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) || Promise.resolve()
  let release!: () => void
  const next = new Promise<void>((resolve) => { release = resolve })
  chains.set(
    key,
    // 无论前一个成功还是失败，都把链继续下去；避免一个 rejection 卡死后续所有预览
    prev.catch(() => {}).then(() => next),
  )
  // 当前任务在前一个完成后开始；完成后 release 让下一个进来
  const run = prev.catch(() => {}).then(task)
  run.then(release, release).finally(() => {
    // 清理：最后一个任务跑完后从 map 移走这个 key，防内存泄漏
    if (chains.get(key) === next || chains.get(key) === run) chains.delete(key)
  })
  return run
}