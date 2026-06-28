import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os
import numpy as np

# Set directories
data_dir = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data"
out_dir = os.path.join(data_dir, "eda_reports")

os.makedirs(out_dir, exist_ok=True)

# Load data
# Adding low_memory=False to avoid DtypeWarning
injuries_df = pd.read_csv(os.path.join(data_dir, "master_injuries_featured.csv"), low_memory=False)
players_df = pd.read_csv(os.path.join(data_dir, "master_players_featured.csv"), low_memory=False)

# Prepare summary text
summary = []
summary.append("EDA Summary Report on Injuries\n")
summary.append("==============================\n\n")

sns.set_theme(style="whitegrid")

# 1. Which positions get injured most?
plt.figure(figsize=(10, 6))
# Try to use Posicion, if missing use Pos
pos_col = 'Posicion' if 'Posicion' in injuries_df.columns and not injuries_df['Posicion'].isnull().all() else 'Pos'
pos_counts = injuries_df[pos_col].value_counts()
sns.barplot(x=pos_counts.index, y=pos_counts.values)
plt.title("Number of Injuries by Position")
plt.xlabel("Position")
plt.ylabel("Injury Count")
plt.savefig(os.path.join(out_dir, "injuries_by_position.png"))
plt.close()

summary.append("1. Positions getting injured most:\n")
summary.append(pos_counts.to_string() + "\n\n")

# 2. Seasonality in injuries
# Using 'Desde' column
injuries_df['Desde'] = pd.to_datetime(injuries_df['Desde'], errors='coerce')
injuries_df['Month'] = injuries_df['Desde'].dt.month
plt.figure(figsize=(10, 6))
month_counts = injuries_df['Month'].value_counts().sort_index()
sns.barplot(x=month_counts.index.astype(int), y=month_counts.values)
plt.title("Seasonality: Injuries by Month")
plt.xlabel("Month")
plt.ylabel("Injury Count")
plt.savefig(os.path.join(out_dir, "injuries_by_month.png"))
plt.close()

summary.append("2. Seasonality (Injuries by month):\n")
summary.append(month_counts.to_string() + "\n\n")

# 3. Types of injuries: Frequent and Severe
# Frequency
plt.figure(figsize=(12, 8))
top_injuries = injuries_df['Tipo_Lesion'].value_counts().head(15)
sns.barplot(y=top_injuries.index, x=top_injuries.values)
plt.title("Top 15 Most Frequent Injuries")
plt.xlabel("Count")
plt.ylabel("Injury Type")
plt.tight_layout()
plt.savefig(os.path.join(out_dir, "frequent_injuries.png"))
plt.close()

# Severity (mean Dias_Baja by injury type, for types with at least 10 occurrences)
injury_stats = injuries_df.groupby('Tipo_Lesion').agg({'Dias_Baja': ['count', 'mean']})
injury_stats.columns = ['count', 'mean_days_out']
severe_injuries = injury_stats[injury_stats['count'] >= 10].sort_values('mean_days_out', ascending=False).head(15)

plt.figure(figsize=(12, 8))
sns.barplot(y=severe_injuries.index, x=severe_injuries['mean_days_out'])
plt.title("Top 15 Most Severe Injuries (Avg Days Out, Min 10 cases)")
plt.xlabel("Average Days Out")
plt.ylabel("Injury Type")
plt.tight_layout()
plt.savefig(os.path.join(out_dir, "severe_injuries.png"))
plt.close()

summary.append("3. Most Frequent Injuries:\n")
summary.append(top_injuries.to_string() + "\n\n")
summary.append("Most Severe Injuries (Avg Days Out):\n")
summary.append(severe_injuries['mean_days_out'].to_string() + "\n\n")

# 4. Age and Injury Correlation
players_df['Age'] = pd.to_numeric(players_df['Age'], errors='coerce')
players_df['total_injuries'] = pd.to_numeric(players_df['total_injuries'], errors='coerce')
players_df_clean = players_df.dropna(subset=['Age', 'total_injuries'])

plt.figure(figsize=(10, 6))
sns.scatterplot(data=players_df_clean, x='Age', y='total_injuries', alpha=0.5)
plt.title("Age vs Total Injuries")
plt.xlabel("Age")
plt.ylabel("Total Injuries")

# Calculate correlation
corr = players_df_clean['Age'].corr(players_df_clean['total_injuries'])
summary.append("4. Age vs Injury Frequency:\n")
summary.append(f"Correlation between Age and Total Injuries: {corr:.3f}\n\n")
plt.text(0.05, 0.95, f'Correlation: {corr:.3f}', transform=plt.gca().transAxes, fontsize=12, verticalalignment='top')
plt.savefig(os.path.join(out_dir, "age_vs_injuries.png"))
plt.close()

# 5. Differences by League and Country
# By League
plt.figure(figsize=(12, 6))
league_injuries = players_df_clean.groupby('League')['total_injuries'].mean().sort_values(ascending=False).head(15)
sns.barplot(y=league_injuries.index, x=league_injuries.values)
plt.title("Average Injuries per Player by League")
plt.xlabel("Average Injuries")
plt.ylabel("League")
plt.tight_layout()
plt.savefig(os.path.join(out_dir, "injuries_by_league.png"))
plt.close()

summary.append("5. Average Injuries by League (Top 15):\n")
summary.append(league_injuries.to_string() + "\n\n")

# By Country
plt.figure(figsize=(12, 8))
country_injuries = players_df_clean.groupby('Country')['total_injuries'].mean().sort_values(ascending=False).head(20)
sns.barplot(y=country_injuries.index, x=country_injuries.values)
plt.title("Average Injuries per Player by Country")
plt.xlabel("Average Injuries")
plt.ylabel("Country")
plt.tight_layout()
plt.savefig(os.path.join(out_dir, "injuries_by_country.png"))
plt.close()

summary.append("Average Injuries by Country (Top 20):\n")
summary.append(country_injuries.to_string() + "\n\n")

# Write summary to file
with open(os.path.join(out_dir, "eda_summary.txt"), "w", encoding="utf-8") as f:
    f.writelines(summary)

print(f"EDA complete. Reports and plots saved to {out_dir}")
