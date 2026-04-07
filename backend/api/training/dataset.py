"""
PyTorch Dataset for the card condition grading model.

Expected directory layout:
    data/
      MT/
        card001.jpg
        card002.jpg
        ...
      NM/
        card100.jpg
        ...
      LP/ MP/ HP/ DMG/

Usage:
    from api.training.dataset import CardConditionDataset, build_loaders

    train_loader, val_loader = build_loaders(
        data_root="data/",
        val_split=0.15,
        batch_size=32,
    )
"""

from __future__ import annotations

import random
from pathlib import Path
from typing import Callable, List, Optional, Tuple

import cv2
import numpy as np

try:
    import torch
    from torch.utils.data import DataLoader, Dataset, Subset
    import torchvision.transforms as T
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

CONDITIONS = ["MT", "NM", "LP", "MP", "HP", "DMG"]
LABEL_TO_IDX = {c: i for i, c in enumerate(CONDITIONS)}


if TORCH_AVAILABLE:
    class CardConditionDataset(Dataset):
        """
        Loads card images from a directory tree organised by condition label.

        Parameters
        ----------
        data_root : str | Path
            Root directory containing one sub-folder per condition label.
        transform : callable, optional
            torchvision transform applied to the PIL image tensor.
            Defaults to the standard ImageNet normalisation.
        augment : bool
            When True, applies data augmentation (flips, colour jitter, erasing).
        """

        def __init__(
            self,
            data_root: str | Path,
            transform: Optional[Callable] = None,
            augment: bool = False,
        ) -> None:
            self.data_root = Path(data_root)
            self.transform = transform or _default_transform(augment=augment)
            self.samples: List[Tuple[Path, int]] = []
            self._load_index()

        def _load_index(self) -> None:
            for label in CONDITIONS:
                label_dir = self.data_root / label
                if not label_dir.is_dir():
                    continue
                for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
                    for img_path in sorted(label_dir.glob(ext)):
                        self.samples.append((img_path, LABEL_TO_IDX[label]))

        def __len__(self) -> int:
            return len(self.samples)

        def __getitem__(self, idx: int) -> Tuple["torch.Tensor", int]:
            img_path, label = self.samples[idx]
            img_bgr = cv2.imread(str(img_path))
            if img_bgr is None:
                raise RuntimeError(f"Cannot read image: {img_path}")
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            # Convert to PIL for torchvision transforms
            from PIL import Image  # noqa: PLC0415
            pil_img = Image.fromarray(img_rgb)
            tensor = self.transform(pil_img)
            return tensor, label

        def class_weights(self) -> "torch.Tensor":
            """
            Return inverse-frequency class weights for use with CrossEntropyLoss.
            Upweights rare conditions (MT, DMG).
            """
            counts = [0] * len(CONDITIONS)
            for _, label in self.samples:
                counts[label] += 1
            total = sum(counts)
            weights = [total / (c + 1e-6) for c in counts]
            # Normalise so mean weight ≈ 1
            mean_w = sum(weights) / len(weights)
            weights = [w / mean_w for w in weights]
            return torch.tensor(weights, dtype=torch.float32)

    def build_loaders(
        data_root: str | Path,
        val_split: float = 0.15,
        batch_size: int = 32,
        num_workers: int = 4,
        seed: int = 42,
    ) -> Tuple[DataLoader, DataLoader]:
        """
        Build train and validation DataLoaders with stratified split.
        """
        full_ds = CardConditionDataset(data_root, augment=True)
        val_ds = CardConditionDataset(data_root, augment=False)

        rng = random.Random(seed)
        indices = list(range(len(full_ds)))
        rng.shuffle(indices)
        n_val = int(len(indices) * val_split)
        val_idx, train_idx = indices[:n_val], indices[n_val:]

        train_loader = DataLoader(
            Subset(full_ds, train_idx),
            batch_size=batch_size,
            shuffle=True,
            num_workers=num_workers,
            pin_memory=True,
        )
        val_loader = DataLoader(
            Subset(val_ds, val_idx),
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers,
            pin_memory=True,
        )
        return train_loader, val_loader


def _default_transform(augment: bool = False):
    if not TORCH_AVAILABLE:
        return None
    import torchvision.transforms as T  # noqa: PLC0415

    base = [
        T.Resize((312, 224)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
    if augment:
        aug = [
            T.RandomHorizontalFlip(p=0.5),
            T.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1, hue=0.05),
            T.RandomRotation(degrees=5),
            T.RandomErasing(p=0.2, scale=(0.02, 0.1)),
        ]
        return T.Compose([T.Resize((312, 224))] + aug + [
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
    return T.Compose(base)
