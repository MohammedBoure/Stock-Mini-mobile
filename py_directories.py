import os

def list_project_files(root_path):
    for dirpath, dirnames, filenames in os.walk(root_path):
        # Print directory
        print(f"[DIR]  {dirpath}")
        # Print files inside
        for filename in filenames:
            print(f"   [FILE] {os.path.join(dirpath, filename)}")

# Change this to your project root path
project_root = "C:\\Users\\ACER\\Desktop\\walid - Copy"

list_project_files(project_root)
