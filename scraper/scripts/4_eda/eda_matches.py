import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

def main():
    data_path = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_matches_featured.csv"
    output_dir = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\eda_reports"
    
    os.makedirs(output_dir, exist_ok=True)
    
    df = pd.read_csv(data_path)
    print("Columns:", df.columns)
    
    summary = []
    summary.append("EDA Report - Matches & Formations")
    summary.append("="*40)
    
    # 1. Win rate by formation
    if 'Formation' in df.columns:
        df_form = df.dropna(subset=['Formation']).copy()
        if not df_form.empty:
            df_form['is_win'] = (df_form['Result'] == 'W').astype(int)
            formation_stats = df_form.groupby('Formation').agg(
                matches=('is_win', 'count'),
                wins=('is_win', 'sum')
            )
            formation_stats['win_rate'] = formation_stats['wins'] / formation_stats['matches']
            formation_stats = formation_stats[formation_stats['matches'] >= 5].sort_values('win_rate', ascending=False)
            
            plt.figure(figsize=(10, 6))
            sns.barplot(x=formation_stats.index, y=formation_stats['win_rate'], color='teal')
            plt.title('Win Rate by Formation (min. 5 matches)')
            plt.ylabel('Win Rate')
            plt.xlabel('Formation')
            plt.xticks(rotation=45)
            plt.tight_layout()
            plt.savefig(os.path.join(output_dir, 'win_rate_by_formation.png'))
            plt.close()
            
            summary.append("\n1. Win Rate by Formation (min 5 matches):")
            for formation, row in formation_stats.iterrows():
                summary.append(f"  {formation}: {row['win_rate']:.1%} ({int(row['wins'])} wins / {int(row['matches'])} matches)")
    
    # 2. Win rate by venue (Home vs Away vs Neutral)
    if 'Venue' in df.columns and 'Result' in df.columns:
        df['is_win'] = (df['Result'] == 'W').astype(int)
        venue_stats = df.groupby('Venue').agg(
            matches=('is_win', 'count'),
            wins=('is_win', 'sum')
        )
        venue_stats['win_rate'] = venue_stats['wins'] / venue_stats['matches']
        
        plt.figure(figsize=(8, 5))
        sns.barplot(x=venue_stats.index, y=venue_stats['win_rate'], color='coral')
        plt.title('Win Rate by Venue')
        plt.ylabel('Win Rate')
        plt.xlabel('Venue')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'win_rate_by_venue.png'))
        plt.close()
        
        summary.append("\n2. Win Rate by Venue:")
        for venue, row in venue_stats.iterrows():
            summary.append(f"  {venue}: {row['win_rate']:.1%} ({int(row['wins'])} wins / {int(row['matches'])} matches)")
            
    # 3. Impact of stadium elevation on results
    if 'Elevation_m' in df.columns:
        print(f"Non-null Elevation_m: {df['Elevation_m'].notna().sum()}")
        df_elev = df.copy()
        df_elev['Elevation_m'] = pd.to_numeric(df_elev['Elevation_m'], errors='coerce')
        df_elev = df_elev.dropna(subset=['Elevation_m'])
        print(f"Valid Elevation_m after numeric conversion: {len(df_elev)}")
        
        if not df_elev.empty:
            bins = [-1, 500, 1000, 2000, 10000]
            labels = ['0-500m', '500-1000m', '1000-2000m', '2000m+']
            df_elev['Elevation_Category'] = pd.cut(df_elev['Elevation_m'], bins=bins, labels=labels)
            
            df_elev['is_win'] = (df_elev['Result'] == 'W').astype(int)
            # Calculate win rate for ALL matches by elevation
            elev_stats = df_elev.groupby('Elevation_Category').agg(
                matches=('is_win', 'count'),
                wins=('is_win', 'sum')
            )
            elev_stats['win_rate'] = elev_stats['wins'] / elev_stats['matches']
            
            plt.figure(figsize=(8, 5))
            sns.barplot(x=elev_stats.index, y=elev_stats['win_rate'], color='skyblue')
            plt.title('Win Rate by Stadium Elevation')
            plt.ylabel('Win Rate')
            plt.xlabel('Elevation Category')
            plt.tight_layout()
            plt.savefig(os.path.join(output_dir, 'elevation_vs_win_rate.png'))
            plt.close()
            
            summary.append("\n3. Win Rate by Stadium Elevation:")
            for cat, row in elev_stats.iterrows():
                if row['matches'] > 0:
                    summary.append(f"  {cat}: {row['win_rate']:.1%} ({int(row['wins'])} wins / {int(row['matches'])} matches)")
                else:
                    summary.append(f"  {cat}: No matches")
    
    # 4. Patterns of calendar congestion (days_since_last_match vs result)
    if 'days_since_last_match' in df.columns:
        df_days = df.copy()
        df_days['days_since_last_match'] = pd.to_numeric(df_days['days_since_last_match'], errors='coerce')
        df_days = df_days.dropna(subset=['days_since_last_match'])
        
        if not df_days.empty:
            bins = [-1, 3, 7, 14, 10000]
            labels = ['0-3 days', '4-7 days', '8-14 days', '15+ days']
            df_days['Congestion'] = pd.cut(df_days['days_since_last_match'], bins=bins, labels=labels)
            
            df_days['is_win'] = (df_days['Result'] == 'W').astype(int)
            cong_stats = df_days.groupby('Congestion').agg(
                matches=('is_win', 'count'),
                wins=('is_win', 'sum')
            )
            cong_stats['win_rate'] = cong_stats['wins'] / cong_stats['matches']
            
            plt.figure(figsize=(8, 5))
            sns.barplot(x=cong_stats.index, y=cong_stats['win_rate'], color='purple')
            plt.title('Win Rate by Calendar Congestion')
            plt.ylabel('Win Rate')
            plt.xlabel('Rest Days')
            plt.tight_layout()
            plt.savefig(os.path.join(output_dir, 'congestion_vs_win_rate.png'))
            plt.close()
            
            summary.append("\n4. Win Rate by Calendar Congestion:")
            for cat, row in cong_stats.iterrows():
                if row['matches'] > 0:
                    summary.append(f"  {cat}: {row['win_rate']:.1%} ({int(row['wins'])} wins / {int(row['matches'])} matches)")
                else:
                    summary.append(f"  {cat}: No matches")
                    
    with open(os.path.join(output_dir, 'matches_eda_summary.txt'), 'w') as f:
        f.write('\n'.join(summary))
        
    print(f"EDA complete. Plots and summary saved to {output_dir}")

if __name__ == '__main__':
    main()
