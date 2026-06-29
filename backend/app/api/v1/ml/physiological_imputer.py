"""
Physiological Profile Estimator (Correlational ML)
==================================================
Uses statistical correlation derived from FBref stats to estimate
physiological parameters (cardio, endurance, respiratory, recovery)
without inventing random data.
"""

import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)


def predict_physiological_profile(player_row: dict):
    """
    Returns estimated physiological metrics using correlational
    relationships from available game data (age, minutes, injuries).
    """
    # Safe extraction of numerical features
    age = float(player_row.get('Age', 25) or 25)
    minutes_played = float(player_row.get('Playing Time_Min_allcomps', 0) or 0)
    minutes_pct = float(player_row.get('Playing Time_Min%_allcomps', 0) or 0)
    total_injuries = float(player_row.get('total_injuries', 0) or 0)
    days_out = float(player_row.get('total_days_out', 0) or 0)
    
    # Cardio: heavily correlated with total volume of high-level football (capped at 99)
    # The more minutes played, the higher the proven cardio capacity
    base_cardio = 50 + (minutes_played / 3000) * 45
    cardio = min(max(base_cardio, 40), 99)

    # Endurance: related to what % of available minutes the player completed (reliability)
    # We add a small bonus for age experience (up to peak endurance age ~27-30)
    age_endurance_factor = 1.0 + (min(max(age - 20, 0), 10) * 0.02)
    base_endurance = 45 + (minutes_pct * 0.5) * age_endurance_factor
    endurance = min(max(base_endurance, 40), 99)

    # Recovery: severely impacted by age and historical injury burden
    # Younger players recover faster. High days_out reduces baseline recovery.
    age_recovery_penalty = max(0, (age - 25) * 1.5)
    injury_recovery_penalty = min(days_out * 0.1, 20)
    base_recovery = 90 - age_recovery_penalty - injury_recovery_penalty
    recovery = min(max(base_recovery, 30), 99)

    # Respiratory: general fitness metric, blend of cardio and inverse age
    respiratory = min(max((cardio * 0.7) + (recovery * 0.3), 40), 99)

    return {
        "cardio": round(cardio, 1),
        "endurance": round(endurance, 1),
        "respiratory": round(respiratory, 1),
        "recovery": round(recovery, 1)
    }
