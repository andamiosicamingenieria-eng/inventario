import os, glob

modules = glob.glob('js/modules/*.js')

imports = """import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

"""

for fpath in modules:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'import { DB' in content:
        continue
        
    new_content = content.replace('window.Mod', 'export const Mod')
    
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(imports + new_content)

print(f'Migrated {len(modules)} modules.')
