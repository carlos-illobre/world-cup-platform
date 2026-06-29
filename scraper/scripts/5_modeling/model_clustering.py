import os
import pandas as pd
import numpy as np
import sys
import shutil
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import matplotlib.pyplot as plt
import seaborn as sns

# Set stdout to use UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')

# Set plotting style
sns.set_theme(style='whitegrid')
plt.rcParams['figure.figsize'] = (10, 8)
plt.rcParams['font.size'] = 12

def main():
    # 1. Load player dataset
    data_path = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_players_featured.csv'
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at {data_path}")
        
    df = pd.read_csv(data_path, low_memory=False)
    print(f"Loaded dataset with shape: {df.shape}")
    
    # 2. Separate Goalkeepers
    gks = df[df['Pos'] == 'GK'].copy()
    outfield = df[df['Pos'] != 'GK'].copy()
    print(f"Separated: Goalkeepers = {len(gks)}, Outfield = {len(outfield)}")
    
    # 3. Calculate playing style rate metrics (per 90 minutes)
    # To avoid extreme rates or division by zero, we filter valid players with >= 0.5 90s
    valid_mask = (outfield['Playing Time_90s_allcomps'] >= 0.5)
    valid_outfield = outfield[valid_mask].copy()
    low_min_outfield = outfield[~valid_mask].copy()
    
    print(f"Valid outfield players (90s >= 0.5): {len(valid_outfield)}")
    print(f"Low-minutes outfield players (90s < 0.5): {len(low_min_outfield)}")
    
    # Define features to calculate
    # We use .fillna(0) for raw counters to handle any missing stats before calculation
    def calc_features(data):
        feats = pd.DataFrame(index=data.index)
        n90s = data['Playing Time_90s_allcomps']
        
        feats['goals_per_90'] = data['Per 90 Minutes_Gls_allcomps'].fillna(0)
        feats['assists_per_90'] = data['Per 90 Minutes_Ast_allcomps'].fillna(0)
        feats['shots_per_90'] = (data['Standard_Sh_allcomps'].fillna(0) / n90s)
        feats['sot_per_90'] = (data['Standard_SoT_allcomps'].fillna(0) / n90s)
        feats['tackles_won_per_90'] = (data['Performance_TklW_allcomps'].fillna(0) / n90s)
        feats['interceptions_per_90'] = (data['Performance_Int_allcomps'].fillna(0) / n90s)
        feats['crosses_per_90'] = (data['Performance_Crs_allcomps'].fillna(0) / n90s)
        feats['fouls_committed_per_90'] = (data['Performance_Fls_allcomps'].fillna(0) / n90s)
        feats['fouls_drawn_per_90'] = (data['Performance_Fld_allcomps'].fillna(0) / n90s)
        feats['offsides_per_90'] = (data['Performance_Off_allcomps'].fillna(0) / n90s)
        
        # Replace infs with 0 (in case there's any division by zero)
        feats.replace([np.inf, -np.inf], 0, inplace=True)
        feats.fillna(0, inplace=True)
        return feats

    # Calculate features for valid outfield players
    X_valid = calc_features(valid_outfield)
    
    # Assign the calculated features back to the DataFrame
    for col in X_valid.columns:
        valid_outfield[col] = X_valid[col]
    
    # 4. Standardize features
    scaler = StandardScaler()
    X_valid_scaled = scaler.fit_transform(X_valid)
    
    # 5. K-Means Clustering (k=5)
    kmeans = KMeans(n_clusters=5, random_state=42, n_init=15)
    valid_labels = kmeans.fit_predict(X_valid_scaled)
    valid_outfield['cluster'] = valid_labels
    
    # 6. Programmatically map K-Means clusters to descriptive football roles
    # We inspect centroids of each cluster to dynamically map them to correct profiles
    centroids = pd.DataFrame(scaler.inverse_transform(kmeans.cluster_centers_), columns=X_valid.columns)
    
    cluster_mapping = {}
    
    # Winger / Wingback: Highest crosses per 90
    winger_cluster = centroids['crosses_per_90'].idxmax()
    cluster_mapping[winger_cluster] = "Carrilero / Extremo de Volumen"
    
    # Striker / Box Forward: Highest offsides (or sot per 90) among unassigned
    remaining = [c for c in range(5) if c not in cluster_mapping]
    striker_cluster = centroids.loc[remaining, 'offsides_per_90'].idxmax()
    cluster_mapping[striker_cluster] = "Goleador / Delantero de Área"
    
    # Defensive Anchor / Ball Winner: Highest tackles_won_per_90 among remaining
    remaining = [c for c in range(5) if c not in cluster_mapping]
    defensive_cluster = centroids.loc[remaining, 'tackles_won_per_90'].idxmax()
    cluster_mapping[defensive_cluster] = "Destructor / Recuperador"
    
    # Creative Elite / Efficient Attacker: Highest goals_per_90 among remaining
    remaining = [c for c in range(5) if c not in cluster_mapping]
    creative_cluster = centroids.loc[remaining, 'goals_per_90'].idxmax()
    cluster_mapping[creative_cluster] = "Atacante Eficiente / Creador"
    
    # Positional Defender / Midfielder: The last remaining cluster
    remaining = [c for c in range(5) if c not in cluster_mapping]
    positional_cluster = remaining[0]
    cluster_mapping[positional_cluster] = "Defensor / Mediocampista Posicional"
    
    print("\nProgrammatic Cluster Mapping based on Centroids:")
    for c_id, role in cluster_mapping.items():
        print(f" - Cluster {c_id} -> {role}")
        
    # Apply mapping to valid outfield players
    valid_outfield['Player_Profile'] = valid_outfield['cluster'].map(cluster_mapping)
    
    # 7. Impute low-minutes outfield players and predict their profiles
    # We impute their features using the position-based median from valid players
    X_low = pd.DataFrame(index=low_min_outfield.index)
    position_medians = valid_outfield.groupby('Pos')[X_valid.columns.tolist()].median()
    # If a position in low-minutes players doesn't exist in valid, use global median
    global_medians = valid_outfield[X_valid.columns].median()
    
    low_feats_list = []
    for idx, row in low_min_outfield.iterrows():
        pos = row['Pos']
        if pos in position_medians.index:
            imputed_row = position_medians.loc[pos].copy()
        else:
            imputed_row = global_medians.copy()
        low_feats_list.append(imputed_row)
        
    if len(low_feats_list) > 0:
        X_low = pd.DataFrame(low_feats_list, index=low_min_outfield.index)
    else:
        X_low = pd.DataFrame(columns=X_valid.columns)
    
    # Add features back to low-minutes DataFrame
    for col in X_low.columns:
        low_min_outfield[col] = X_low[col]
        
    X_low_scaled = scaler.transform(X_low) if len(X_low) > 0 else np.empty((0, len(X_valid.columns)))
    
    if len(low_min_outfield) > 0:
        low_labels = kmeans.predict(X_low_scaled)
        low_min_outfield['cluster'] = low_labels
        low_min_outfield['Player_Profile'] = low_min_outfield['cluster'].map(cluster_mapping)
    
    # 8. Set Goalkeeper profile directly
    gks['cluster'] = -1
    gks['Player_Profile'] = "Guardameta / Portero"
    
    # Add dummy feature columns to GKs so concat works cleanly without missing columns
    for col in X_valid.columns:
        gks[col] = np.nan
        
    # 9. Recombine all players
    final_df = pd.concat([valid_outfield, low_min_outfield, gks]).sort_index()
    
    # 10. Generate Visualizations (PCA & t-SNE)
    os.makedirs(r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\models', exist_ok=True)
    
    # Additional output directories for the platform
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    PLATFORM_PLOTS_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'models', 'shap_plots')
    PLATFORM_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'models', 'metrics')
    BACKEND_PLOTS_DIR = os.path.join(SCRIPT_DIR, '..', '..', '..', 'backend', 'static', 'model_plots')
    BACKEND_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', '..', 'backend', 'static', 'model_metrics')
    for d in [PLATFORM_PLOTS_DIR, PLATFORM_METRICS_DIR, BACKEND_PLOTS_DIR, BACKEND_METRICS_DIR]:
        os.makedirs(d, exist_ok=True)
    
    # Prepare all outfield features for visualization (including imputed ones)
    X_all_outfield = pd.concat([X_valid, X_low]).sort_index()
    X_all_scaled = scaler.transform(X_all_outfield)
    outfield_combined = pd.concat([valid_outfield, low_min_outfield]).sort_index()
    
    # PCA Plot
    pca = PCA(n_components=2, random_state=42)
    X_pca = pca.fit_transform(X_all_scaled)
    outfield_combined['PCA1'] = X_pca[:, 0]
    outfield_combined['PCA2'] = X_pca[:, 1]
    
    plt.figure(figsize=(10, 8))
    sns.scatterplot(
        data=outfield_combined, x='PCA1', y='PCA2', 
        hue='Player_Profile', palette='Set1', alpha=0.7, s=60
    )
    plt.title('Perfiles de Jugador - Reducción Dimensional PCA')
    plt.xlabel(f'PCA Componente 1 ({pca.explained_variance_ratio_[0]*100:.1f}% var)')
    plt.ylabel(f'PCA Componente 2 ({pca.explained_variance_ratio_[1]*100:.1f}% var)')
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left', title='Perfil de Juego')
    plt.tight_layout()
    pca_plot_path = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\models\player_clusters_pca.png'
    plt.savefig(pca_plot_path, dpi=150)
    plt.close()
    for dest_dir in [PLATFORM_PLOTS_DIR, BACKEND_PLOTS_DIR]:
        shutil.copy2(pca_plot_path, os.path.join(dest_dir, 'player_clusters_pca.png'))
    print(f"Saved PCA plot to: {pca_plot_path} (+ platform + backend)")
    
    # t-SNE Plot
    tsne = TSNE(n_components=2, perplexity=30, random_state=42)
    X_tsne = tsne.fit_transform(X_all_scaled)
    outfield_combined['tSNE1'] = X_tsne[:, 0]
    outfield_combined['tSNE2'] = X_tsne[:, 1]
    
    plt.figure(figsize=(10, 8))
    sns.scatterplot(
        data=outfield_combined, x='tSNE1', y='tSNE2', 
        hue='Player_Profile', palette='Set1', alpha=0.7, s=60
    )
    plt.title('Perfiles de Jugador - Reducción Dimensional t-SNE')
    plt.xlabel('t-SNE Componente 1')
    plt.ylabel('t-SNE Componente 2')
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left', title='Perfil de Juego')
    plt.tight_layout()
    tsne_plot_path = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\models\player_clusters_tsne.png'
    plt.savefig(tsne_plot_path, dpi=150)
    plt.close()
    for dest_dir in [PLATFORM_PLOTS_DIR, BACKEND_PLOTS_DIR]:
        shutil.copy2(tsne_plot_path, os.path.join(dest_dir, 'player_clusters_tsne.png'))
    print(f"Saved t-SNE plot to: {tsne_plot_path} (+ platform + backend)")
    
    # 11. Write profiling metrics and description
    metrics_path = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\models\clustering_metrics.txt'
    with open(metrics_path, 'w', encoding='utf-8') as f:
        f.write("==================================================\n")
        f.write("  REPORTE DE CLUSTERING - PERFILES DE JUGADORES  \n")
        f.write("==================================================\n\n")
        f.write(f"Total de jugadores analizados: {len(final_df)}\n")
        f.write(f" - Porteros: {len(gks)}\n")
        f.write(f" - Jugadores de campo con stats suficientes: {len(valid_outfield)}\n")
        f.write(f" - Jugadores de campo con minutos bajos (imputados): {len(low_min_outfield)}\n\n")
        
        f.write("Distribución de Perfiles:\n")
        counts = final_df['Player_Profile'].value_counts()
        for role, count in counts.items():
            pct = count / len(final_df) * 100
            f.write(f" - {role:35}: {count:3} jugadores ({pct:.1f}%)\n")
            
        f.write("\nCentros de los Clústeres (Medias de Features):\n")
        # Recalculate feature means based on recombined outfield players
        outfield_with_features = pd.concat([X_valid, X_low]).sort_index()
        outfield_with_features['Player_Profile'] = outfield_combined['Player_Profile']
        means = outfield_with_features.groupby('Player_Profile').mean()
        f.write(means.round(4).to_string())
        
        f.write("\n\nExplicación Táctica de Perfiles:\n")
        f.write("1. Guardameta / Portero: Especialistas de portería, excluidos del clustering de campo.\n")
        f.write("2. Defensor / Mediocampista Posicional: Jugadores conservadores, con baja participación en eventos ofensivos directos. Dominan la organización táctica.\n")
        f.write("3. Destructor / Recuperador: Jugadores defensivos muy activos. Alta tasa de entradas ganadas, intercepciones y faltas cometidas.\n")
        f.write("4. Carrileros / Extremos de Volumen: Jugadores de banda extremadamente activos. Elevado volumen de centros, regates y faltas sufridas.\n")
        f.write("5. Goleador / Delanteros de Área: Finalizadores netos. Alto volumen de disparos, tiros a puerta, fueras de juego y goles.\n")
        f.write("6. Atacante Eficiente / Creador: Mediapuntas o creadores de juego altamente resolutivos. Registran alta producción de goles y asistencias por minuto sin requerir alto volumen de disparos.\n")

    print(f"Saved clustering report to: {metrics_path}")
    for dest_dir in [PLATFORM_METRICS_DIR, BACKEND_METRICS_DIR]:
        shutil.copy2(metrics_path, os.path.join(dest_dir, 'clustering_metrics.txt'))
    print("  → Copied to platform + backend")
    
    # 12. Export clustered players dataset
    output_csv_path = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_players_clustered.csv'
    final_df.to_csv(output_csv_path, index=False, encoding='utf-8')
    print(f"Successfully exported final clustered players dataset to: {output_csv_path}")

if __name__ == '__main__':
    main()
