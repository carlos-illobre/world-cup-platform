"""
Generate HDBSCAN training plots for the Data Science view.
Produces:
  - hdbscan_clusters_pca.png (PCA 2D scatter colored by HDBSCAN labels)
  - hdbscan_condensed_tree.png (condensed tree / dendrogram)
  - hdbscan_membership_proba.png (histogram of membership probabilities)
"""

import pandas as pd
import numpy as np
import joblib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import os

OUTPUT_DIR = 'static/model_plots'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load data
print("Loading data...")
df = pd.read_csv('data/csv/master_players_enriched.csv', low_memory=False)

features = [
    'goals_per_90', 'assists_per_90', 'shots_per_90', 'sot_per_90',
    'tackles_won_per_90', 'interceptions_per_90', 'crosses_per_90',
    'fouls_committed_per_90', 'fouls_drawn_per_90', 'offsides_per_90'
]

clustered = df[df['cluster'].notna()].copy()
clustered = clustered.dropna(subset=features)
X = clustered[features].values.astype(float)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Load HDBSCAN results
hdb_data = joblib.load('data/models/clustering_hdbscan.pkl')
hdb_labels = np.array(hdb_data['labels'])
hdb_probs = np.array(hdb_data['probabilities'])

print(f"Players: {len(X)}, HDBSCAN labels: {len(hdb_labels)}")

# PCA
pca = PCA(n_components=2, random_state=42)
X_2d = pca.fit_transform(X_scaled)


# ═══ PLOT 1: HDBSCAN PCA Scatter ═══
print("Generating PCA scatter plot...")
fig, ax = plt.subplots(1, 1, figsize=(10, 8))
fig.patch.set_facecolor('#0a0a0a')
ax.set_facecolor('#0a0a0a')

# Plot noise points first (small, grey)
noise_mask = hdb_labels == -1
ax.scatter(
    X_2d[noise_mask, 0], X_2d[noise_mask, 1],
    c='#555555', s=8, alpha=0.3, label=f'Ruido ({noise_mask.sum()} jugadores)'
)

# Plot clustered points
colors = ['#06b6d4', '#f59e0b', '#a855f7', '#10b981', '#ef4444', '#3b82f6']
unique_labels = sorted(set(hdb_labels) - {-1})
for i, label in enumerate(unique_labels):
    mask = hdb_labels == label
    color = colors[i % len(colors)]
    ax.scatter(
        X_2d[mask, 0], X_2d[mask, 1],
        c=color, s=40, alpha=0.8, edgecolors=color,
        label=f'Cluster {label} ({mask.sum()} jugadores)'
    )

ax.set_xlabel('PC1', color='white', fontsize=12)
ax.set_ylabel('PC2', color='white', fontsize=12)
ax.set_title('HDBSCAN — Clusters en espacio PCA(2D)', color='white', fontsize=14, pad=15)
ax.tick_params(colors='#888888')
ax.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=9)
for spine in ax.spines.values():
    spine.set_color('#333')

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'hdbscan_clusters_pca.png'), dpi=150, facecolor='#0a0a0a')
plt.close()
print(f"  Saved: {OUTPUT_DIR}/hdbscan_clusters_pca.png")


# ═══ PLOT 2: Membership Probability Distribution ═══
print("Generating membership probability histogram...")
fig, ax = plt.subplots(1, 1, figsize=(10, 5))
fig.patch.set_facecolor('#0a0a0a')
ax.set_facecolor('#0a0a0a')

# Only non-noise points have meaningful probabilities
non_noise_probs = hdb_probs[hdb_labels != -1]
noise_probs = hdb_probs[hdb_labels == -1]

ax.hist(non_noise_probs, bins=20, color='#06b6d4', alpha=0.8,
        edgecolor='#0891b2', label=f'Clasificados (n={len(non_noise_probs)})')
if len(noise_probs) > 0:
    ax.hist(noise_probs, bins=20, color='#555555', alpha=0.5,
            edgecolor='#333', label=f'Ruido (n={len(noise_probs)})')

ax.set_xlabel('Probabilidad de Pertenencia al Cluster', color='white', fontsize=11)
ax.set_ylabel('Cantidad de Jugadores', color='white', fontsize=11)
ax.set_title('HDBSCAN — Distribución de Membership Probability', color='white', fontsize=13, pad=10)
ax.tick_params(colors='#888888')
ax.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=10)
for spine in ax.spines.values():
    spine.set_color('#333')

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'hdbscan_membership_proba.png'), dpi=150, facecolor='#0a0a0a')
plt.close()
print(f"  Saved: {OUTPUT_DIR}/hdbscan_membership_proba.png")


# ═══ PLOT 3: Side-by-side K-Means vs HDBSCAN ═══
print("Generating side-by-side comparison plot...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))
fig.patch.set_facecolor('#0a0a0a')

# K-Means (left)
ax1.set_facecolor('#0a0a0a')
kmeans_labels = clustered['cluster'].values.astype(int)
kmeans_colors = ['#f59e0b', '#10b981', '#a855f7', '#ef4444', '#3b82f6']
for label in sorted(np.unique(kmeans_labels)):
    mask = kmeans_labels == label
    ax1.scatter(X_2d[mask, 0], X_2d[mask, 1],
                c=kmeans_colors[label % len(kmeans_colors)],
                s=20, alpha=0.6, label=f'Cluster {label}')
ax1.set_title('K-Means (k=5) — 100% asignados', color='white', fontsize=12)
ax1.set_xlabel('PC1', color='#888')
ax1.set_ylabel('PC2', color='#888')
ax1.tick_params(colors='#666')
ax1.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=8)
for spine in ax1.spines.values():
    spine.set_color('#333')

# HDBSCAN (right)
ax2.set_facecolor('#0a0a0a')
ax2.scatter(X_2d[noise_mask, 0], X_2d[noise_mask, 1],
            c='#444', s=5, alpha=0.2, label=f'Ruido ({noise_mask.sum()})')
for i, label in enumerate(unique_labels):
    mask = hdb_labels == label
    ax2.scatter(X_2d[mask, 0], X_2d[mask, 1],
                c=colors[i % len(colors)], s=30, alpha=0.8,
                label=f'Cluster {label} ({mask.sum()})')
ax2.set_title(f'HDBSCAN — {len(unique_labels)} clusters + {noise_mask.sum()} ruido', color='white', fontsize=12)
ax2.set_xlabel('PC1', color='#888')
ax2.set_ylabel('PC2', color='#888')
ax2.tick_params(colors='#666')
ax2.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=8)
for spine in ax2.spines.values():
    spine.set_color('#333')

plt.suptitle('Comparación Visual: K-Means vs HDBSCAN (misma proyección PCA)',
             color='white', fontsize=14, y=0.98)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'clustering_comparison_kmeans_vs_hdbscan.png'),
            dpi=150, facecolor='#0a0a0a')
plt.close()
print(f"  Saved: {OUTPUT_DIR}/clustering_comparison_kmeans_vs_hdbscan.png")


# ═══ PLOT 4: Condensed Tree (if hdbscan lib available) ═══
print("Generating condensed tree...")
try:
    import hdbscan

    hdb = hdbscan.HDBSCAN(min_cluster_size=30, min_samples=10, metric='euclidean')
    hdb.fit(X_scaled)

    fig, ax = plt.subplots(1, 1, figsize=(12, 6))
    fig.patch.set_facecolor('#0a0a0a')
    ax.set_facecolor('#0a0a0a')
    hdb.condensed_tree_.plot(select_clusters=True, ax=ax,
                             colorbar=False, log_size=True)
    ax.set_title('HDBSCAN — Condensed Tree (dendrograma de densidad)',
                 color='white', fontsize=13, pad=10)
    ax.tick_params(colors='#888')
    for spine in ax.spines.values():
        spine.set_color('#333')
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'hdbscan_condensed_tree.png'),
                dpi=150, facecolor='#0a0a0a')
    plt.close()
    print(f"  Saved: {OUTPUT_DIR}/hdbscan_condensed_tree.png")
except Exception as e:
    print(f"  WARNING: Could not generate condensed tree: {e}")

print("\nDone! All HDBSCAN plots generated.")
