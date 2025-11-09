#!/usr/bin/env python3
"""
Phase Structure Generator

This script parses the ActionPlan.md file and generates the folder structure
with task files similar to the Phase1 folder structure.

It creates:
- Phase{N}/ folders for each phase
- TaskCheckList{N}.md with all tasks for that phase
- Task{N}/ folders for each task
- Task{N}.md with task details
- TaskCompleteNote{N}.md (empty, for completion notes)
- TaskReview{N}.md (empty, for review notes)
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Tuple


class Task:
    """Represents a single task with its details."""
    
    def __init__(self, number: str, title: str, goal: str, actions: List[str], 
                 success_criteria: str):
        self.number = number
        self.title = title
        self.goal = goal
        self.actions = actions
        self.success_criteria = success_criteria
    
    def get_full_title(self) -> str:
        """Returns the task title with number."""
        return f"Task {self.number}: {self.title}"
    
    def to_task_md(self) -> str:
        """Generates the Task{N}.md content."""
        actions_text = "\n".join([f"- {action}" for action in self.actions])
        
        return f"""# {self.get_full_title()}

**Goal**: {self.goal}

**Actions**:

{actions_text}

**Success Criteria**: {self.success_criteria}
"""
    
    def to_checklist_section(self) -> str:
        """Generates the checklist section for this task."""
        actions_text = "\n".join([f"- [ ] {action}" for action in self.actions])
        
        return f"""### {self.get_full_title()}

{actions_text}
- [ ] **Success Criteria**: {self.success_criteria}
"""


class Phase:
    """Represents a phase with multiple tasks."""
    
    def __init__(self, number: int, title: str, description: str = ""):
        self.number = number
        self.title = title
        self.description = description
        self.tasks: List[Task] = []
    
    def add_task(self, task: Task):
        """Adds a task to this phase."""
        self.tasks.append(task)
    
    def to_checklist_md(self) -> str:
        """Generates the TaskCheckList{N}.md content."""
        tasks_text = "\n\n".join([task.to_checklist_section() for task in self.tasks])
        
        return f"""# Task Checklist for Phase {self.number}: {self.title}

## Overview

{self.description if self.description else f"This phase focuses on {self.title.lower()}."}

## Tasks

{tasks_text}
"""


def parse_action_plan(file_path: str) -> List[Phase]:
    """Parses the ActionPlan.md file and extracts phases and tasks."""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    phases: List[Phase] = []
    current_phase: Phase | None = None
    current_task: Dict = {}
    current_section = None
    current_list_items: List[str] = []
    
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        # Match Phase headers: ## Phase N: Title
        phase_match = re.match(r'^## Phase (\d+): (.+)$', line)
        if phase_match:
            # Save previous task if exists
            if current_task and current_phase:
                task = Task(
                    number=current_task['number'],
                    title=current_task['title'],
                    goal=current_task.get('goal', ''),
                    actions=current_task.get('actions', []),
                    success_criteria=current_task.get('success_criteria', '')
                )
                current_phase.add_task(task)
                current_task = {}
                current_list_items = []
            
            phase_num = int(phase_match.group(1))
            phase_title = phase_match.group(2)
            current_phase = Phase(phase_num, phase_title)
            phases.append(current_phase)
            current_section = None
            continue
        
        # Match Task headers: ### Task N.M: Title
        task_match = re.match(r'^### Task ([\d\.]+): (.+)$', line)
        if task_match:
            # Save previous task if exists
            if current_task and current_phase:
                task = Task(
                    number=current_task['number'],
                    title=current_task['title'],
                    goal=current_task.get('goal', ''),
                    actions=current_task.get('actions', []),
                    success_criteria=current_task.get('success_criteria', '')
                )
                current_phase.add_task(task)
            
            current_task = {
                'number': task_match.group(1),
                'title': task_match.group(2),
                'actions': [],
            }
            current_list_items = []
            current_section = None
            continue
        
        # Match section headers
        if line.startswith('**Goal**:'):
            current_section = 'goal'
            goal_text = line.replace('**Goal**:', '').strip()
            if goal_text:
                current_task['goal'] = goal_text
            continue
        
        if line.startswith('**Actions**:'):
            current_section = 'actions'
            current_list_items = []
            continue
        
        if line.startswith('**Success Criteria**:'):
            current_section = 'success_criteria'
            criteria_text = line.replace('**Success Criteria**:', '').strip()
            if criteria_text:
                current_task['success_criteria'] = criteria_text
            continue
        
        # Process content based on current section
        if current_section == 'goal' and line.strip() and not line.startswith('#'):
            if 'goal' not in current_task:
                current_task['goal'] = line.strip()
            else:
                current_task['goal'] += ' ' + line.strip()
        
        if current_section == 'actions' and line.strip().startswith('- '):
            action_text = line.strip()[2:]  # Remove '- '
            current_list_items.append(action_text)
            current_task['actions'] = current_list_items
        
        if current_section == 'success_criteria' and line.strip() and not line.startswith('#'):
            if 'success_criteria' not in current_task:
                current_task['success_criteria'] = line.strip()
            else:
                current_task['success_criteria'] += ' ' + line.strip()
    
    # Save last task
    if current_task and current_phase:
        task = Task(
            number=current_task['number'],
            title=current_task['title'],
            goal=current_task.get('goal', ''),
            actions=current_task.get('actions', []),
            success_criteria=current_task.get('success_criteria', '')
        )
        current_phase.add_task(task)
    
    return phases


def create_phase_structure(phases: List[Phase], base_dir: str = '/workspace/ActionPlan'):
    """Creates the folder structure and files for all phases."""
    
    base_path = Path(base_dir)
    base_path.mkdir(exist_ok=True)
    print(f"Created base directory: {base_path}")
    
    for phase in phases:
        # Create Phase directory
        phase_dir = base_path / f"Phase{phase.number}"
        phase_dir.mkdir(exist_ok=True)
        print(f"Created directory: {phase_dir}")
        
        # Create TaskCheckList file
        checklist_file = phase_dir / f"TaskCheckList{phase.number}.md"
        with open(checklist_file, 'w', encoding='utf-8') as f:
            f.write(phase.to_checklist_md())
        print(f"Created file: {checklist_file}")
        
        # Create Task subdirectories and files
        for i, task in enumerate(phase.tasks, 1):
            task_dir = phase_dir / f"Task{i}"
            task_dir.mkdir(exist_ok=True)
            print(f"Created directory: {task_dir}")
            
            # Create Task{N}.md
            task_file = task_dir / f"Task{i}.md"
            with open(task_file, 'w', encoding='utf-8') as f:
                f.write(task.to_task_md())
            print(f"Created file: {task_file}")
            
            # Create empty TaskCompleteNote{N}.md
            complete_note_file = task_dir / f"TaskCompleteNote{i}.md"
            with open(complete_note_file, 'w', encoding='utf-8') as f:
                f.write("")
            print(f"Created file: {complete_note_file}")
            
            # Create empty TaskReview{N}.md
            review_file = task_dir / f"TaskReview{i}.md"
            with open(review_file, 'w', encoding='utf-8') as f:
                f.write("")
            print(f"Created file: {review_file}")


def main():
    """Main function to run the phase structure generator."""
    
    action_plan_path = '/workspace/ActionPlan.md'
    
    if not os.path.exists(action_plan_path):
        print(f"Error: {action_plan_path} not found!")
        return
    
    print("Parsing ActionPlan.md...")
    phases = parse_action_plan(action_plan_path)
    
    print(f"\nFound {len(phases)} phases")
    for phase in phases:
        print(f"  Phase {phase.number}: {phase.title} ({len(phase.tasks)} tasks)")
    
    print("\nGenerating folder structure...")
    create_phase_structure(phases)
    
    print("\n✅ Phase structure generation complete!")


if __name__ == "__main__":
    main()
