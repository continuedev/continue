import {
    ContextItem,
    ContextProviderDescription,
    ContextProviderExtras,
    ContextSubmenuItem,
    LoadSubmenuItemsArgs,
  } from "../../index.js";
import { BaseContextProvider } from "../index.js";
import childProcess from "node:child_process";
import util from "node:util";
import { fileURLToPath} from "node:url";


const asyncExec = util.promisify(childProcess.exec);

class GitCommitContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "commit",
    displayTitle: "Commits",
    description: "Type to search",
    type: "submenu",
  };

  async getContextItems(query: string, extras: ContextProviderExtras): Promise<ContextItem[]> {
    const lastXCommitsDepth = this.options?.LastXCommitsDepth ?? 10;
    const topLevelDir = fileURLToPath((await extras.ide.getWorkspaceDirs())[0]);
    try{
      if(query.includes("last ")){
        return [
          {
          name: query,
          description: query,
          content: (await asyncExec(`git --no-pager log --pretty=format:"%H,%h,%an,%ae,%ad,%P,%s,%b" -p -n ${lastXCommitsDepth}`, {cwd: topLevelDir})).stdout,
          }
        ]
      }
      else{
        console.log('query');
        return [
          {
            name: query,
            description: `commit ${query}`,
            content: (await asyncExec(`git --no-pager show --pretty=format:"%H,%h,%an,%ae,%ad,%P,%s,%b" ${query}`, {cwd: topLevelDir})).stdout,
          }
        ]

      }
    }catch(err){
      return [];
    }
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const depth = this.options?.Depth ?? 50;
    const lastXCommitsDepth = this.options?.LastXCommitsDepth ?? 10;
    const topLevelDir =  fileURLToPath((await args.ide.getWorkspaceDirs())[0]);
    console.log(topLevelDir);
    try{
      const gitResult = await asyncExec(`git --no-pager log --pretty=format:"%H:%s" -n ${depth}`, {cwd: topLevelDir});
      if (gitResult.stderr.toLowerCase().includes('fatal')) {
        console.log(gitResult.stderr);
        throw new Error(gitResult.stderr);
      }
      return [{ id: `last ${lastXCommitsDepth} commits`, title: `last ${lastXCommitsDepth} commits`, description: "recent commits" }]
      .concat(
        gitResult.stdout
          .trim()
          .split('\n')
          .map(line => {
            const [hash, message] = line.split(":");
            console.log("line", line);
            console.log(message);
            if(!hash || hash === ""){console.log('empty');}
            return {
              id: hash,
              title: message,
              description: hash
            };
          })
      );
    }catch(err: any){
      console.log(err.message);
      //could be nice to toast the error eg. not a git repo or git is not installed
      return [];
    }
  }
}

export default GitCommitContextProvider;
