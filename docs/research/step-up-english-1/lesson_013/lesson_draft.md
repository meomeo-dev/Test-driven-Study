# 第 13 课时：名词与代词系统精讲：第 3 讲 不可数名词与度量量词（Partitives）搭配
所属单元：第2单元：名词与代词系统精讲

## 1. 核心理论与技术标准
无资料

## 2. 工程实践与典型参数
# FAE Research Notes: Engineering Drawing & BOM Partitive Specifications (`a piece of` / `set of` / `roll of`)

## 1. Executive Summary & Standards Framework
In industrial engineering and manufacturing documentation, precise quantification of materials and components is governed by international drafting and configuration standards (e.g., **ASME Y14.34** *Associated Lists*, **ASME Y14.100** *Engineering Drawing Practices*, and **ISO 1101 / ISO 10303 STEP**). 

Partitive expressions translate into formal **Units of Measure (UoM)** and item categorization in Bill of Materials (BOM) structures:
- **`a piece of` (Countable discrete components / singular stock cut):** Represented by individual item numbers (`ea` or `pc`), detailing machined parts, molded housings, fasteners, and discrete hardware.
- **`set of` (Kits / functional assembly groups):** Represented by kit part numbers with sub-BOMs, grouping gaskets, O-rings, hardware packets, or pre-wired modular harnesses.
- **`roll of` (Continuous bulk stock):** Represented by linear units (meters/feet) or designated as `AR` (As Required), covering electrical wire, braided sleeving, heat shrink tubing, gasket sealing cord, and adhesive tapes.

---

## 2. Comparative Engineering Parameter Table

| Partitive Term | Industrial Equivalent / UoM | BOM / Drawing Application | Standards Reference | Typical Tolerance / Handling Rule |
| :--- | :--- | :--- | :--- | :--- |
| **`a piece of`** | `EA` (Each), `PC` (Piece) | Structural brackets, shafts, machined housings, custom sheet metal blanks. | ASME Y14.100, ISO 128 | Nominal dimensions + GD&T positional/profile tolerances. |
| **`set of`** | `KIT`, `SET` | Maintenance overhaul kits, fastener sorting packages, pre-assembled multi-component linkages. | ASME Y14.34 (Associated Lists) | Strict kit integrity check; missing items halt assembly line. |
| **`roll of`** | `M` (Meters), `FT` (Feet), `AR` (As Required) | Electrical wiring harnesses, EMI shielding tape, continuous PTFE thread seal tape, rubber extrusion seals. | IPC-A-620 (Wire Harnesses), ASTM standard stock | Cutting allowance (+5% wastage factor); batch traceability on spool labels. |

---

## 3. Real-World Engineering Case Studies

### Case A: Automotive Wiring Harness Assembly (`roll of`)
- **Scenario:** An automated wire-cutting and stripping cell consumes primary automotive primary wire (GXL copper wire) supplied on bulk reels.
- **BOM Specification:** `WIRE, GXL, 18 AWG, RED` — Quantity: `125.0 M` (or referenced as `AR` with cut-length table in drawing notes).
- **Engineering Rule:** Continuous roll materials must specify gauge, conductor stranding, insulation rating (e.g., SAE J1128), and spool tension parameters to prevent stretching during automatic feeding.

### Case B: Hydraulic Cylinder Overhaul Kit (`set of`)
- **Scenario:** Field service maintenance for heavy construction equipment hydraulic cylinders.
- **BOM Specification:** `SEAL KIT, HYDRAULIC CYLINDER, 50MM BORE` — Quantity: `1 SET` (Containing: 1 wiper ring, 1 rod seal, 1 buffer seal, 2 backup rings, 1 piston seal, 2 O-rings).
- **Engineering Rule:** Kits are assigned a parent part number in the ERP/PLM system. Individual elastomeric components carry shelf-life expiration dates per SAE AS1931.

### Case C: Custom Machined Mounting Bracket (`a piece of`)
- **Scenario:** Structural equipment mounting bracket machined from 6061-T6 aluminum plate.
- **BOM Specification:** `BRACKET, MOUNTING, RADAR SENSOR` — Quantity: `4 EA`.
- **Engineering Rule:** Each piece is individually ballooned on the mechanical assembly drawing (`DWG-8821-04`) and inspected via CMM (Coordinate Measuring Machine) against 2D datums.

---

## 4. References & Standards
1. **ASME Y14.34-2013:** *Associated Lists* (Standard for parts lists, data lists, and index lists).
2. **ASME Y14.100-2017:** *Engineering Drawing Practices* (Governing drawing layout, notes, and BOM item numbering).
3. **IPC/WHMA-A-620E:** *Requirements and Acceptance for Cable and Wire Harness Assemblies*.
4. **OpenBOM & PLM Industry Best Practices:** Managing discrete vs. bulk vs. kit item masters in manufacturing resource planning (MRP).

## 3. 常见失效模式与诊断要点
无资料
