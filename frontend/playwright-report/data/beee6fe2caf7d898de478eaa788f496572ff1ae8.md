# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - button "🇺🇸" [expanded] [ref=e8] [cursor=pointer]:
      - generic [ref=e9] [cursor=pointer]: 🇺🇸
      - img [ref=e10] [cursor=pointer]
    - generic [ref=e14]: A
    - heading "Sign in" [level=2] [ref=e15]
    - paragraph [ref=e16]: auth.description
  - generic [ref=e18]:
    - generic [ref=e19]:
      - button "auth.continue_with_google" [ref=e20] [cursor=pointer]:
        - img [ref=e21] [cursor=pointer]
        - generic [ref=e26] [cursor=pointer]: auth.continue_with_google
      - button "auth.continue_with_microsoft" [ref=e27] [cursor=pointer]:
        - img [ref=e28] [cursor=pointer]
        - generic [ref=e33] [cursor=pointer]: auth.continue_with_microsoft
    - generic [ref=e39]: auth.or
    - generic [ref=e40]:
      - generic [ref=e41]:
        - generic [ref=e42]: auth.email_address
        - textbox "auth.email_address" [ref=e44]
      - generic [ref=e45]:
        - generic [ref=e46]: auth.password
        - textbox "auth.password" [ref=e48]
      - button "auth.sign_in" [ref=e50] [cursor=pointer]
    - generic [ref=e51]:
      - paragraph [ref=e52]: Access your Agoralia workspace
      - paragraph [ref=e53]:
        - link "auth.register" [ref=e54] [cursor=pointer]:
          - /url: /auth/register
      - paragraph [ref=e55]:
        - link "auth.need_help" [ref=e56] [cursor=pointer]:
          - /url: mailto:support@agoralia.com
```