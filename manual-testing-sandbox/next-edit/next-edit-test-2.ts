type DocumentNode = ParagraphNode | ListNode;

abstract class Node {
  abstract render(): string;
}

class ParagraphNode extends Node {
  constructor(public text: string) {
    super();
  }

  render(): string {
    return `<p>${this.text}</p>`;
  }
}

class ListNode extends Node {
  constructor(public items: string[]) {
    super();
  }

  render(): string {
    return `<ul>${this.items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
  }
}

interface Command {
  execute(): void;
  undo(): void;
}

interface Observer {
  update(doc: DocumentEditor): void;
}

class DocumentEditor {
  private nodes: DocumentNode[] = [];
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private observers: Observer[] = [];

  addNode(node: DocumentNode) {
    this.nodes.push(node);
    this.notify();
  }

  executeCommand(command: Command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    this.notify();
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
      this.notify();
    }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.execute();
      this.undoStack.push(cmd);
      this.notify();
    }
  }

  getContent(): string {
    return this.nodes.map((n) => n.render()).join("\n");
  }

  getNodes(): DocumentNode[] {
    return this.nodes;
  }

  setNodes(nodes: DocumentNode[]) {
    this.nodes = nodes;
  }

  subscribe(observer: Observer) {
    this.observers.push(observer);
  }

  private notify() {
    this.observers.forEach((o) => o.update(this));
  }
}
