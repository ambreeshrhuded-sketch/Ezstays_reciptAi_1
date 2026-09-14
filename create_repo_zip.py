import os
import zipfile

def make_repo_zip():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    # Destination outputs
    public_dir = os.path.join(base_dir, 'public')
    os.makedirs(public_dir, exist_ok=True)
    
    zip_path_public = os.path.join(public_dir, 'hostel-flow-repo.zip')
    zip_path_root = os.path.join(base_dir, 'hostel-flow-repo.zip')
    
    # Files and directories to include
    include_exact = [
        '.env.example',
        '.gitignore',
        'README.md',
        'firebase-applet-config.json',
        'firestore.rules',
        'storage.rules',
        'index.html',
        'metadata.json',
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'server.ts'
    ]
    
    include_dirs = ['src', 'scripts']
    
    ignore_extensions = ['.zip', '.tar', '.gz', '.log']
    ignore_names = ['node_modules', 'dist', 'build', '.git', '.DS_Store', 'create_repo_zip.py']

    def should_include(rel_path):
        parts = rel_path.split(os.sep)
        for part in parts:
            if part in ignore_names:
                return False
        for ext in ignore_extensions:
            if rel_path.endswith(ext):
                return False
        return True

    files_to_pack = []

    # Collect exact root files
    for item in include_exact:
        full_path = os.path.join(base_dir, item)
        if os.path.isfile(full_path):
            files_to_pack.append((full_path, item))

    # Collect directories
    for d in include_dirs:
        full_d = os.path.join(base_dir, d)
        if os.path.isdir(full_d):
            for root, dirs, files in os.walk(full_d):
                for f in files:
                    full_f = os.path.join(root, f)
                    rel_f = os.path.relpath(full_f, base_dir)
                    if should_include(rel_f):
                        files_to_pack.append((full_f, rel_f))

    print(f"Packaging {len(files_to_pack)} repository files into ZIP...")

    for target_zip in [zip_path_public, zip_path_root]:
        with zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
            for full_p, arc_name in files_to_pack:
                # Prepend folder name so when extracted it extracts to hostel-flow-repo/
                archive_path = os.path.join('hostel-receipt-ai', arc_name)
                zf.write(full_p, archive_path)
        
        file_size_kb = os.path.getsize(target_zip) / 1024
        print(f"Created {target_zip} ({file_size_kb:.1f} KB)")

if __name__ == '__main__':
    make_repo_zip()
