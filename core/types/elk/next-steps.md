Yes. A few ELK features look useful for vmblu, but I would phase them carefully.

**Most Useful Next**
1. **Interactive / incremental layout**
   Use current node positions as hints when re-layouting an existing hand-edited model. This could make “auto layout” less destructive and later support “layout selected area”.
   Relevant options include `org.eclipse.elk.interactiveLayout` and layered interactive reference options.

2. **Model order / port order controls**
   vmblu already has meaningful visual order: interfaces, pins, node order in the model. ELK has options for considering model order and port order. This may reduce surprising node swaps and make repeated layouts more stable.
   Useful around: `org.eclipse.elk.layered.considerModelOrder.*`, `org.eclipse.elk.port.index`, `org.eclipse.elk.layered.portSortingStrategy`.

3. **Port spacing and port alignment**
   We currently preserve vmblu pin y positions, but ELK has native port spacing/alignment options. Later, if we let ELK move pins within an interface, these become relevant.
   Relevant options: `org.eclipse.elk.spacing.portPort`, `org.eclipse.elk.portAlignment.east/west`, `org.eclipse.elk.spacing.portsSurrounding`.

4. **Compound / hierarchy layout**
   This maps to vmblu group nodes. Not first-pass simple, but ELK explicitly supports hierarchy/compound graph layout. This could eventually layout group internals and external edges more intelligently.
   Relevant option: `org.eclipse.elk.hierarchyHandling`.

5. **Connected component handling**
   Useful for models with several independent clusters. ELK can separate and compact connected components, which could help generated models.
   Relevant options: `org.eclipse.elk.separateConnectedComponents`, `org.eclipse.elk.layered.compaction.connectedComponents`.

6. **Edge priorities**
   vmblu could mark important flows, like main model/root paths, as higher priority so ELK favors shorter/straighter routes for them.
   Relevant options include layered priority options such as direction, shortness, straightness.

7. **Self-loop and feedback edge handling**
   If vmblu models have cycles or node-to-same-node connections, ELK has options for feedback edges and self-loop routing.
   Relevant options: `org.eclipse.elk.layered.feedbackEdges`, `org.eclipse.elk.layered.edgeRouting.selfLoopDistribution`.

My recommended order:
1. stabilize current full-model auto-layout;
2. add interactive/incremental mode for existing models;
3. add model-order/port-order tuning;
4. then tackle group/compound layout.

Sources: ELK option reference and ELK Layered reference:
- https://eclipse.dev/elk/reference/options.html
- https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html