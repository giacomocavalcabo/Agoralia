# Translation Guidelines

## General Principles

1. **Use Translation Keys**
   - Never hardcode strings
   - Use meaningful key names
   - Organize keys hierarchically

2. **Supported Languages**
   - English (en-US) - Primary
   - Italian (it-IT)
   - Other languages as needed

3. **File Structure**
   ```
   frontend/
     public/
       locales/
         en-US/
           common.json
           pages.json
         it-IT/
           common.json
           pages.json
   ```

4. **Translation Process**
   - Extract strings to translation files
   - Use placeholder syntax for variables
   - Maintain consistent terminology
   - Consider context and cultural differences

5. **Quality Assurance**
   - Review translations
   - Check for missing keys
   - Validate placeholder usage
   - Test in context
