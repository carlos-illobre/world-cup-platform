import os
import shutil
import glob

def create_dirs(dirs):
    for d in dirs:
        os.makedirs(d, exist_ok=True)

# Structure
dirs_to_create = [
    'data/1_raw',
    'data/2_cleaned',
    'data/3_master',
    'data/4_featured',
    'models/pkl',
    'models/metrics',
    'models/shap_plots',
    'scripts/1_scraping',
    'scripts/2_data_prep',
    'scripts/3_feature_eng',
    'scripts/4_eda',
    'scripts/5_modeling',
    'app/backend',
    'app/frontend',
    'docs'
]

create_dirs(dirs_to_create)

def move_files(pattern, dest_folder):
    for f in glob.glob(pattern):
        if os.path.isfile(f):
            dest_path = os.path.join(dest_folder, os.path.basename(f))
            try:
                shutil.move(f, dest_path)
            except Exception as e:
                print(f"Error moving {f}: {e}")

# Move Scripts
move_files('scrape_*.py', 'scripts/1_scraping')
move_files('get_stadium_data.py', 'scripts/1_scraping')
move_files('download_player_images.py', 'scripts/1_scraping')

move_files('clean_*.py', 'scripts/2_data_prep')
move_files('unified_data/clean_*.py', 'scripts/2_data_prep')
move_files('unify_*.py', 'scripts/2_data_prep')
move_files('merge_data.py', 'scripts/2_data_prep')

move_files('feature_eng_*.py', 'scripts/3_feature_eng')
move_files('unified_data/feature_eng_*.py', 'scripts/3_feature_eng')
move_files('final_encoding.py', 'scripts/3_feature_eng')

move_files('eda_*.py', 'scripts/4_eda')
move_files('unified_data/eda_*.py', 'scripts/4_eda')

move_files('model_*.py', 'scripts/5_modeling')
move_files('unified_data/models/model_*.py', 'scripts/5_modeling')

# Move App
if os.path.exists('backend/main.py'):
    shutil.move('backend/main.py', 'app/backend/main.py')
# Move frontend contents
for f in glob.glob('frontend/*'):
    shutil.move(f, 'app/frontend/')

# Move Docs
move_files('executive_report.md', 'docs')
move_files('unified_data/eda_reports/*', 'docs')

# Move Models
move_files('unified_data/models/*.pkl', 'models/pkl')
move_files('unified_data/models/*metrics*.txt', 'models/metrics')
move_files('unified_data/models/*.txt', 'models/metrics')
move_files('unified_data/models/*.png', 'models/shap_plots')
move_files('unified_data/models/shap_plots/*.png', 'models/shap_plots')

# Move Data (Features & Masters)
move_files('unified_data/master_*_featured.csv', 'data/4_featured')
move_files('unified_data/master_*_clustered.csv', 'data/4_featured')
move_files('unified_data/X_*.csv', 'data/4_featured')
move_files('unified_data/encoders.pkl', 'data/4_featured')
move_files('unified_data/optimal_squads.csv', 'data/4_featured')

move_files('unified_data/master_players.csv', 'data/3_master')
move_files('unified_data/master_matches.csv', 'data/3_master')
move_files('unified_data/master_teams.csv', 'data/3_master')
move_files('unified_data/master_injuries.csv', 'data/3_master')

# Move Data (Cleaned)
move_files('unified_data/cleaned/*.csv', 'data/2_cleaned')
move_files('unified_data/cleaned_*.csv', 'data/2_cleaned')

# Move Data (Raw)
move_files('unified_data/all_competitions_*.csv', 'data/1_raw')
move_files('unified_data/world_cup_*.csv', 'data/1_raw')
move_files('unified_data/all_countries_injuries.csv', 'data/1_raw')
move_files('unified_data/selected_countries_injuries.csv', 'data/1_raw')
move_files('argentina_injuries.csv', 'data/1_raw')
move_files('unified_data/totals_*.csv', 'data/1_raw')
for f in glob.glob('unified_data/additional/*'):
    shutil.move(f, 'data/1_raw/')

# Clean up empty directories
for d in ['backend', 'frontend', 'unified_data/cleaned', 'unified_data/additional', 'unified_data/models/shap_plots', 'unified_data/models', 'unified_data/eda_reports', 'unified_data']:
    if os.path.exists(d):
        try:
            os.rmdir(d)
        except OSError:
            pass # Directory not empty

print("Reorganization complete.")
