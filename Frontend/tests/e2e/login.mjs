// Shared sign-in for the e2e scripts: every app route sits behind /login.
export async function signIn(page, base, name = 'Hannah Lee', workspace) {
  await page.goto(base + '/login')
  if (workspace) await page.getByRole('radio', { name: new RegExp(workspace, 'i') }).click()
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}
