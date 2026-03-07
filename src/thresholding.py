import numpy as np
from sklearn.metrics import precision_recall_curve


def find_best_f1_threshold(y_true, y_prob):
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)

    # thresholds has length n-1 compared to precision/recall
    best_threshold = 0.5
    best_f1 = 0.0

    for i, threshold in enumerate(thresholds):
        p = precision[i]
        r = recall[i]
        if p + r == 0:
            f1 = 0.0
        else:
            f1 = 2 * p * r / (p + r)

        if f1 > best_f1:
            best_f1 = f1
            best_threshold = threshold

    return float(best_threshold), float(best_f1)


def apply_threshold(y_prob, threshold: float):
    return (y_prob >= threshold).astype(int)