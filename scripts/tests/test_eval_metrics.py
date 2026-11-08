"""Unit tests for the metric functions in scripts/eval.py, using synthetic embeddings."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import numpy as np
import pytest

# scripts/eval.py is a script, not a package module; load it by path (its name shadows the builtin).
_spec = importlib.util.spec_from_file_location("tera_eval", Path(__file__).resolve().parents[1] / "eval.py")
ev = importlib.util.module_from_spec(_spec)
sys.modules["tera_eval"] = ev
_spec.loader.exec_module(ev)


def unit(vectors) -> np.ndarray:
    array = np.asarray(vectors, dtype=np.float64)
    return array / np.linalg.norm(array, axis=-1, keepdims=True)


def test_split_dogs_is_by_individual_and_deterministic():
    dogs = [f"dog{i}" for i in range(10)]
    registered, unregistered = ev.split_dogs(dogs, 0.3, seed=1)
    assert len(unregistered) == 3 and len(registered) == 7
    assert set(registered).isdisjoint(unregistered)
    assert set(registered) | set(unregistered) == set(dogs)
    assert ev.split_dogs(dogs, 0.3, seed=1) == (registered, unregistered)


def test_split_gallery_probe_always_leaves_a_probe():
    gallery, probes = ev.split_gallery_probe([1, 2], gallery_per_dog=2, seed=0)
    assert len(gallery) == 1 and len(probes) == 1
    gallery, probes = ev.split_gallery_probe([1, 2, 3, 4, 5], gallery_per_dog=2, seed=0)
    assert len(gallery) == 2 and len(probes) == 3
    assert sorted(gallery + probes) == [1, 2, 3, 4, 5]


def test_per_dog_scores_takes_max_over_each_dogs_gallery():
    gallery = unit([[1, 0], [0, 1], [1, 1]])
    gallery_dog = np.array([0, 0, 1])
    probe = unit([[1, 0.1]])
    scores = ev.per_dog_scores(probe, gallery, gallery_dog, n_dogs=2)
    assert scores.shape == (1, 2)
    assert scores[0, 0] == pytest.approx(float(probe[0] @ gallery[0]))  # best of dog 0's two photos
    assert scores[0, 1] == pytest.approx(float(probe[0] @ gallery[2]))


def test_rank_k_accuracy():
    scores = np.array([[0.9, 0.1, 0.2], [0.5, 0.6, 0.7], [0.3, 0.8, 0.1]])
    true_dog = np.array([0, 0, 1])  # ranks: 1, 3, 1
    assert ev.rank_k_accuracy(scores, true_dog, 1) == pytest.approx(2 / 3)
    assert ev.rank_k_accuracy(scores, true_dog, 2) == pytest.approx(2 / 3)
    assert ev.rank_k_accuracy(scores, true_dog, 3) == pytest.approx(1.0)


def test_genuine_and_impostor_include_unregistered_pairs():
    scores = np.array([[0.9, 0.2], [0.3, 0.8]])
    genuine, impostor = ev.genuine_and_impostor(scores, np.array([0, 1]), np.array([[0.4, 0.1]]))
    assert sorted(genuine.tolist()) == [0.8, 0.9]
    assert sorted(impostor.tolist()) == [0.1, 0.2, 0.3, 0.4]


def test_tar_at_far_uses_threshold_that_respects_far():
    impostor = np.linspace(0.0, 0.99, 100)  # 100 impostor scores
    genuine = np.array([0.5, 0.985, 0.995, 1.0])
    tar, threshold = ev.tar_at_far(genuine, impostor, far=0.01)
    assert (impostor >= threshold).mean() <= 0.01
    assert threshold > 0.98  # the 2nd-highest impostor (0.98) must be rejected
    assert tar == pytest.approx(0.75)


def test_tar_at_far_perfect_separation():
    tar, threshold = ev.tar_at_far(np.array([0.9, 0.95]), np.array([0.1, 0.2, 0.3]), far=0.01)
    assert tar == 1.0 and 0.3 < threshold <= 0.9


def test_strong_threshold_caps_error_rate():
    # 100 correct answers at high scores, then wrong answers mixed in at lower scores.
    scores = np.concatenate([np.linspace(0.9, 0.7, 100), [0.65, 0.6, 0.55]])
    correct = np.concatenate([np.ones(100, dtype=bool), [False, True, False]])
    threshold = ev.strong_threshold(scores, correct, max_error=0.01)
    selected = scores >= threshold
    assert (~correct[selected]).mean() <= 0.01
    assert threshold == pytest.approx(0.6)  # 1 wrong out of 102 is still <= 1%


def test_strong_threshold_none_when_unreachable():
    assert ev.strong_threshold(np.array([0.9, 0.8]), np.array([False, False]), 0.01) is None


def test_unsure_threshold_balances_misses_and_false_passes():
    genuine = np.array([0.5, 0.6, 0.7, 0.8])
    unregistered_best = np.array([0.2, 0.3, 0.4, 0.55])
    threshold = ev.unsure_threshold(genuine, unregistered_best)
    miss = (genuine < threshold).mean()
    false_pass = (unregistered_best >= threshold).mean()
    assert miss == false_pass == 0.25  # t = 0.55: misses 0.5, lets 0.55 through
    assert ev.rejection_rate(np.array([0.1, 0.2, 0.9]), 0.5) == pytest.approx(2 / 3)


def test_compute_metrics_on_well_separated_synthetic_dogs():
    rng = np.random.default_rng(0)
    centers = unit(rng.normal(size=(20, 64)))
    embeddings = {f"dog{i:02d}": list(unit(centers[i] + 0.05 * rng.normal(size=(4, 64)))) for i in range(20)}
    registered, unregistered = ev.split_dogs(list(embeddings), 0.3, seed=0)
    metrics = ev.compute_metrics(embeddings, registered, unregistered, gallery_per_dog=2, seed=0)
    assert metrics["gallery_dogs"] == 14 and metrics["unregistered_dogs"] == 6
    assert metrics["gallery_photos"] == 28 and metrics["probe_photos"] == 28
    assert metrics["rank1"] == 1.0 and metrics["rank5"] == 1.0
    assert metrics["tar_at_far_1pct"] == 1.0
    assert metrics["unregistered_rejected_at_unsure"] == 1.0
    assert metrics["match_unsure"] <= metrics["match_strong"]


def test_compute_metrics_drops_registered_dogs_with_one_photo():
    vec = unit(np.eye(4))
    embeddings = {"a": [vec[0], vec[0]], "b": [vec[1]], "c": [vec[2]]}
    metrics = ev.compute_metrics(embeddings, ["a", "b"], ["c"], gallery_per_dog=2, seed=0)
    assert metrics["gallery_dogs"] == 1 and metrics["registered_dogs_dropped"] == 1


def test_render_without_runs_says_not_evaluated():
    assert "Belum dievaluasi pada data nyata" in ev.render_markdown([])


def test_strong_threshold_ignores_tiny_selections():
    # Only the top 3 probes are error-free; that is too few to recommend a threshold.
    scores = np.linspace(1.0, 0.0, 50)
    correct = np.array([True] * 3 + [False] * 47)
    assert ev.strong_threshold(scores, correct, max_error=0.01, min_support=20) is None
    assert ev.strong_threshold(scores, correct, max_error=0.01, min_support=1) == pytest.approx(scores[2])


def test_threshold_table_rates():
    rows = ev.threshold_table(np.array([0.9, 0.6, 0.4]), np.array([True, False, True]), np.array([0.7, 0.2]), [0.5])
    assert rows == [
        {
            "threshold": 0.5,
            "registered_correct": pytest.approx(1 / 3),
            "registered_wrong": pytest.approx(1 / 3),
            "unregistered_accepted": 0.5,
        }
    ]


def test_deduplicate_merges_folders_sharing_a_photo_and_drops_copies():
    vec = unit(np.eye(5))
    photos = {
        "rex": [("a", vec[0]), ("b", vec[1])],
        "rex-again": [("c", vec[0]), ("d", vec[2])],  # same photo as rex/a -> same dog
        "bella": [("e", vec[3]), ("f", vec[3]), ("g", vec[4])],  # f is a copy of e
    }
    merged, stats = ev.deduplicate(photos, threshold=0.97)
    assert stats == {"folders_merged": 1, "duplicate_photos_dropped": 2}
    assert sorted(len(v) for v in merged.values()) == [2, 3]
