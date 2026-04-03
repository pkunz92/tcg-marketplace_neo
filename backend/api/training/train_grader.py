"""
Offline training script for the EfficientNet-B4 card condition grader.

Usage:
    # From backend/ directory:
    python -m api.training.train_grader \\
        --data-root data/grading/ \\
        --output-dir api/ml/models/ \\
        --epochs 30 \\
        --batch-size 32

Requirements:
    pip install torch torchvision  # CPU build is sufficient for inference;
                                   # GPU recommended for training

Data layout:
    data/grading/
        MT/  NM/  LP/  MP/  HP/  DMG/
            card001.jpg ...

Produces:
    api/ml/models/grader_efficientnet_b4.pt   ← loaded by grader.py
    api/ml/models/training_run.json           ← metrics for the run
"""

from __future__ import annotations

import argparse
import json
import logging
import time
from pathlib import Path
from typing import Dict, List

logger = logging.getLogger(__name__)

CONDITIONS = ["MT", "NM", "LP", "MP", "HP", "DMG"]


def train(
    data_root: str,
    output_dir: str,
    epochs: int = 30,
    batch_size: int = 32,
    lr: float = 1e-4,
    weight_decay: float = 1e-2,
    freeze_epochs: int = 5,
    num_workers: int = 4,
    seed: int = 42,
) -> Dict:
    """
    Train EfficientNet-B4 on labelled card condition images.

    Returns a dict of training metrics (loss, accuracy per epoch).
    """
    import torch  # noqa: PLC0415
    import torch.nn as nn  # noqa: PLC0415
    import torchvision.models as M  # noqa: PLC0415
    from sklearn.metrics import classification_report, f1_score  # noqa: PLC0415

    from .dataset import CardConditionDataset, build_loaders  # noqa: PLC0415

    torch.manual_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Training on device: %s", device)

    # ── Data ──────────────────────────────────────────────────────────────────
    train_loader, val_loader = build_loaders(
        data_root, batch_size=batch_size, num_workers=num_workers, seed=seed
    )
    full_ds = CardConditionDataset(data_root)
    class_weights = full_ds.class_weights().to(device)
    logger.info("Dataset: %d train  %d val", len(train_loader.dataset),
                len(val_loader.dataset))

    # ── Model ─────────────────────────────────────────────────────────────────
    model = M.efficientnet_b4(weights=M.EfficientNet_B4_Weights.IMAGENET1K_V1)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, 512),
        nn.ReLU(),
        nn.Dropout(p=0.2),
        nn.Linear(512, len(CONDITIONS)),
    )
    model = model.to(device)

    # ── Loss and optimiser ────────────────────────────────────────────────────
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    metrics: Dict[str, List] = {
        "train_loss": [], "val_loss": [], "val_accuracy": [], "val_f1": []
    }
    best_f1 = 0.0
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    model_save_path = output_path / "grader_efficientnet_b4.pt"

    for epoch in range(1, epochs + 1):
        t0 = time.time()

        # Freeze backbone for the first `freeze_epochs` epochs
        for name, param in model.named_parameters():
            if "classifier" not in name:
                param.requires_grad = epoch > freeze_epochs

        # ── Training pass ──────────────────────────────────────────────────
        model.train()
        total_loss = 0.0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * images.size(0)
        train_loss = total_loss / len(train_loader.dataset)

        # ── Validation pass ────────────────────────────────────────────────
        model.eval()
        val_loss = 0.0
        all_preds: List[int] = []
        all_labels: List[int] = []
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                logits = model(images)
                loss = criterion(logits, labels)
                val_loss += loss.item() * images.size(0)
                preds = logits.argmax(dim=1).cpu().tolist()
                all_preds.extend(preds)
                all_labels.extend(labels.cpu().tolist())

        val_loss /= len(val_loader.dataset)
        accuracy = sum(p == l for p, l in zip(all_preds, all_labels)) / len(all_labels)
        f1 = f1_score(all_labels, all_preds, average="weighted", zero_division=0)

        scheduler.step()
        elapsed = time.time() - t0
        logger.info(
            "Epoch %d/%d  train_loss=%.4f  val_loss=%.4f  acc=%.3f  f1=%.3f  %.1fs",
            epoch, epochs, train_loss, val_loss, accuracy, f1, elapsed
        )

        metrics["train_loss"].append(round(train_loss, 4))
        metrics["val_loss"].append(round(val_loss, 4))
        metrics["val_accuracy"].append(round(accuracy, 4))
        metrics["val_f1"].append(round(f1, 4))

        if f1 > best_f1:
            best_f1 = f1
            torch.save(model.state_dict(), model_save_path)
            logger.info("  ✓ New best model saved (f1=%.4f)", best_f1)

    # ── Final report ──────────────────────────────────────────────────────────
    logger.info("\nClassification Report (best epoch):\n%s",
                classification_report(all_labels, all_preds,
                                      target_names=CONDITIONS, zero_division=0))

    run_meta = {
        "best_val_f1": round(best_f1, 4),
        "epochs": epochs,
        "batch_size": batch_size,
        "lr": lr,
        "model_path": str(model_save_path),
        "per_epoch": metrics,
    }
    with open(output_path / "training_run.json", "w") as f:
        json.dump(run_meta, f, indent=2)

    return run_meta


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train EfficientNet-B4 card condition grader"
    )
    parser.add_argument("--data-root", required=True,
                        help="Root directory with MT/ NM/ LP/ MP/ HP/ DMG/ sub-folders")
    parser.add_argument("--output-dir", default="api/ml/models/",
                        help="Where to save model weights and metrics")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--freeze-epochs", type=int, default=5,
                        help="Freeze backbone for first N epochs")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%H:%M:%S",
    )

    result = train(
        data_root=args.data_root,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        freeze_epochs=args.freeze_epochs,
        num_workers=args.workers,
    )
    print(f"\nTraining complete.  Best val F1: {result['best_val_f1']}")
    print(f"Model saved to: {result['model_path']}")


if __name__ == "__main__":
    main()
