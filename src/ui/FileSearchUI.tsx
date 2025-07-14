import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";
import { glob } from "glob";

interface FileSearchUIProps {
  filter: string;
  selectedIndex: number;
  onSelect: (filePath: string) => void;
  onFilesUpdated?: (files: FileItem[]) => void;
}

interface FileItem {
  path: string;
  displayName: string;
}

const FileSearchUI: React.FC<FileSearchUIProps> = ({
  filter,
  selectedIndex,
  onSelect,
  onFilesUpdated,
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const searchFiles = async () => {
      setIsLoading(true);
      try {
        // Search for files matching the filter
        const patterns = [
          "**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,cs,go,rs,rb,php,swift,kt,scala,clj,hs,ml,sh,md,json,yaml,yml,xml,html,css,scss,sass,less,sql,r,m,mm,pl,lua,dart,jl,ex,exs,elm,fs,fsx,ml,mli,v,sv,vhd,vhdl,asm,s,S,f,f90,f95,f03,f08,for,ftn,fpp,F,F90,F95,F03,F08,FOR,FTN,FPP,ada,adb,ads,pas,pp,inc,lpr,dpr,dfm,fmx,lfm,lrs,lpi,lpk,lps,lrt,cfg,conf,config,toml,ini,properties,env,dockerfile,Dockerfile,makefile,Makefile,CMakeLists.txt,BUILD,WORKSPACE,bzl,bazel,gradle,pom.xml,package.json,Cargo.toml,requirements.txt,setup.py,pyproject.toml,composer.json,Gemfile,Podfile,Package.swift,project.pbxproj,*.xcodeproj,*.xcworkspace,*.sln,*.csproj,*.vbproj,*.fsproj,*.vcxproj,*.vcproj,*.dsp,*.dsw,*.pro,*.pri,*.qbs,*.cmake,*.am,*.in,*.m4,*.ac,*.mk,*.mak,*.ninja,*.gyp,*.gypi,*.gn,*.gni,*.bp,*.mm,*.pch,*.plist,*.entitlements,*.storyboard,*.xib,*.nib,*.strings,*.stringsdict,*.lproj,*.bundle,*.framework,*.dylib,*.so,*.dll,*.lib,*.a,*.o,*.obj,*.exe,*.app,*.deb,*.rpm,*.dmg,*.pkg,*.msi,*.tar.gz,*.tgz,*.tar.bz2,*.tbz2,*.tar.xz,*.txz,*.zip,*.7z,*.rar,*.iso,*.img,*.bin,*.hex,*.elf,*.out,*.com,*.bat,*.cmd,*.ps1,*.psm1,*.psd1,*.ps1xml,*.pssc,*.psrc,*.cdxml}",
          "**/*.txt",
          "**/*.log",
          "**/README*",
          "**/LICENSE*",
          "**/CHANGELOG*",
          "**/CONTRIBUTING*",
          "**/.gitignore",
          "**/.env*",
        ];

        const allFiles: string[] = [];
        
        for (const pattern of patterns) {
          const matches = await glob(pattern, {
            ignore: [
              "**/node_modules/**",
              "**/dist/**",
              "**/build/**",
              "**/out/**",
              "**/target/**",
              "**/.git/**",
              "**/.vscode/**",
              "**/.idea/**",
              "**/coverage/**",
              "**/*.min.js",
              "**/*.min.css",
              "**/*.bundle.js",
              "**/*.bundle.css",
              "**/.DS_Store",
              "**/Thumbs.db",
              "**/*.log",
              "**/*.tmp",
              "**/*.temp",
              "**/*.swp",
              "**/*.swo",
              "**/*.bak",
              "**/*.orig",
              "**/*.rej",
              "**/*.pyc",
              "**/*.pyo",
              "**/*.class",
              "**/*.o",
              "**/*.obj",
              "**/*.exe",
              "**/*.dll",
              "**/*.so",
              "**/*.dylib",
              "**/*.a",
              "**/*.lib",
              "**/*.jar",
              "**/*.war",
              "**/*.ear",
              "**/*.zip",
              "**/*.tar.gz",
              "**/*.tgz",
              "**/*.rar",
              "**/*.7z",
            ],
            dot: true,
            absolute: false,
          });
          allFiles.push(...matches);
        }

        // Remove duplicates and sort
        const uniqueFiles = [...new Set(allFiles)];
        
        const fileItems: FileItem[] = uniqueFiles.map((path) => ({
          path,
          displayName: path.split('/').pop() || path,
        }));

        // Filter files based on the current filter
        const filteredFiles = fileItems
          .filter((file) => {
            if (filter.length === 0) {
              return true; // Show all files when no filter
            }
            const lowerFilter = filter.toLowerCase();
            return (
              file.displayName.toLowerCase().includes(lowerFilter) ||
              file.path.toLowerCase().includes(lowerFilter)
            );
          })
          .sort((a, b) => {
            if (filter.length === 0) {
              // When no filter, sort by file name
              return a.displayName.localeCompare(b.displayName);
            }
            
            const lowerFilter = filter.toLowerCase();
            
            // Prioritize exact matches in file name
            const aNameMatch = a.displayName.toLowerCase().includes(lowerFilter);
            const bNameMatch = b.displayName.toLowerCase().includes(lowerFilter);
            
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            
            // Then prioritize files that start with the filter
            const aStartsWith = a.displayName.toLowerCase().startsWith(lowerFilter);
            const bStartsWith = b.displayName.toLowerCase().startsWith(lowerFilter);
            
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            
            // Finally, sort by file name
            return a.displayName.localeCompare(b.displayName);
          })
          .slice(0, 10); // Limit to 10 results for screen space

        setFiles(filteredFiles);
        if (onFilesUpdated) {
          onFilesUpdated(filteredFiles);
        }
      } catch (error) {
        console.error("Error searching files:", error);
        setFiles([]);
        if (onFilesUpdated) {
          onFilesUpdated([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    searchFiles();
  }, [filter, onFilesUpdated]);

  if (isLoading) {
    return (
      <Box paddingX={1} marginX={1} marginBottom={1}>
        <Text color="gray">Searching files...</Text>
      </Box>
    );
  }

  if (files.length === 0) {
    return (
      <Box paddingX={1} marginX={1} marginBottom={1}>
        <Text color="gray">No matching files found</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} marginX={1} marginBottom={1} flexDirection="column">
      {files.map((file, index) => {
        const isSelected = index === selectedIndex;

        return (
          <Box key={file.path}>
            <Text color="white" bold={isSelected}>
              {"  "}
              <Text color="green">@{file.displayName}</Text>
            </Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use ↑/↓ to navigate, Enter to select, Tab to complete
        </Text>
      </Box>
    </Box>
  );
};

export default FileSearchUI;