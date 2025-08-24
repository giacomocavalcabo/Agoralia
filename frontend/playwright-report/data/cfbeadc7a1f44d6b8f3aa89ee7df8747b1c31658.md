# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - button "🇺🇸 English" [expanded] [ref=e8] [cursor=pointer]:
      - generic [ref=e9] [cursor=pointer]: 🇺🇸
      - generic [ref=e10] [cursor=pointer]: English
      - img [ref=e11] [cursor=pointer]
    - generic [ref=e15]: A
    - heading "Sign in" [level=2] [ref=e16]
    - paragraph [ref=e17]: auth.description
  - generic [ref=e19]:
    - generic [ref=e20]:
      - button "auth.continue_with_google" [ref=e21] [cursor=pointer]:
        - img [ref=e22] [cursor=pointer]
        - generic [ref=e27] [cursor=pointer]: auth.continue_with_google
      - button "auth.continue_with_microsoft" [ref=e28] [cursor=pointer]:
        - img [ref=e29] [cursor=pointer]
        - generic [ref=e34] [cursor=pointer]: auth.continue_with_microsoft
    - generic [ref=e40]: auth.or
    - generic [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]: auth.email_address
        - textbox "auth.email_address" [ref=e45]
      - generic [ref=e46]:
        - generic [ref=e47]: auth.password
        - textbox "auth.password" [ref=e49]
      - button "auth.sign_in" [ref=e51] [cursor=pointer]
    - generic [ref=e52]:
      - paragraph [ref=e53]: Access your Agoralia workspace
      - paragraph [ref=e54]:
        - link "auth.register" [ref=e55] [cursor=pointer]:
          - /url: /auth/register
      - paragraph [ref=e56]:
        - link "auth.need_help" [ref=e57] [cursor=pointer]:
          - /url: mailto:support@agoralia.com
```