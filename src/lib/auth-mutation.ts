/** Serialize user-initiated sign-in/out with confirmed-deletion cleanup. Token
 * refresh remains with the auth SDK; this adds no auth requests or retries. */
let queue: Promise<unknown> = Promise.resolve();
export function withAuthMutation<T>(action: () => Promise<T>): Promise<T> {
  const task = queue.then(action);
  queue = task.catch(() => {});
  return task;
}
