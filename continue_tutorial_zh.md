# Continue 中文使用入门教程

本文档将引导您了解 Continue 的主要功能、安装步骤以及基本用法，帮助您快速上手这款强大的AI代码助手。

---

# 什么是Continue

Continue是一款开源工具，旨在帮助开发者创建自定义的AI代码助手。

Continue的目标是将AI辅助功能无缝集成到开发者的工作流程中，从而提高编程效率和体验。

Continue支持主流的集成开发环境（IDE），包括VS Code和JetBrains系列IDE（如IntelliJ IDEA, PyCharm等）。

---

# 主要功能

Continue 提供了一系列强大的功能，旨在提升您的编码体验：

- **Agent（代理）**: 对于涉及多个文件或需要对代码库进行更广泛更改的复杂任务，Agent 功能可以提供帮助。它可以理解代码库的结构，并协助您进行大规模的重构或功能实现。

- **Chat（聊天）**: 直接在您的IDE中与大型语言模型（LLM）进行交互。您可以提出问题、请求代码解释、生成代码片段，或就您的代码获取反馈，所有这些都在您的开发环境中进行。

- **Autocomplete（自动补全）**: 在您键入代码时，Continue 会提供智能的、上下文感知的代码建议。这可以加快您的编码速度，并减少错误。

- **Edit（编辑）**: 对于快速、局部的代码修改，Edit 功能非常有用。您可以高亮一段代码，并指示Continue进行特定的更改，例如“将此函数转换为异步函数”或“为此类添加文档字符串”。

- **Hub（中心）**: Continue Hub 是一个社区平台，您可以在这里分享和发现自定义的AI模型、提示（prompts）、配置以及其他Continue插件。这使得您可以轻松地扩展Continue的功能，并从社区的集体智慧中受益。

---

# 使用场景

Continue 可以在多种开发场景中提供帮助，提升您的工作效率和代码质量：

- **理解现有代码**:
  当您接触一个陌生的代码库或一段复杂的代码时，Continue 可以帮助您快速理解其功能和结构。您可以通过聊天功能提问，例如：“这段代码是做什么的？”或“解释一下这个函数的逻辑。”

- **生成新代码或样板代码**:
  无论是创建新的文件、实现一个函数，还是编写重复性的样板代码，Continue 都可以为您代劳。例如，您可以要求：“为这个类生成一个Python的构造函数和getter/setter方法”，或者“创建一个React组件，包含一个输入框和一个提交按钮。”

- **代码重构**:
  Continue 可以协助您改进现有代码的质量。您可以要求它：“将这个JavaScript函数重构为使用async/await”，或者“优化这段代码的性能”，或者“将这段代码提取到一个新的函数中。”

- **辅助调试**:
  当遇到错误或bug时，Continue 可以成为您的调试助手。您可以粘贴错误信息并询问：“这个错误是什么意思？”或“帮我找出这段代码可能存在的问题。” Continue可以帮助分析问题，并提供可能的解决方案。

- **学习新的编程语言或框架**:
  对于初学者或希望扩展技能的开发者，Continue 是一个很好的学习工具。您可以通过提问来学习新的语法、概念或最佳实践，例如：“如何在Python中使用列表推导？”或“解释一下React中的useEffect钩子。” Continue可以提供解释和代码示例，加速您的学习过程。

- **编写单元测试**:
  Continue 可以帮助您为代码生成单元测试。例如，您可以要求：“为这个函数编写Jest单元测试”，确保您的代码按预期工作。

- **文档编写**:
  您可以让Continue帮助您为代码添加注释或编写文档字符串。例如：“为这个Python函数添加一个清晰的文档字符串。”

以下是一些针对Java开发者的更具体的实际案例，演示如何在常见的Java开发任务中使用Continue：

### 案例一：使用Continue辅助生成Spring Boot REST Controller接口方法

**技术栈:** Java 17, Spring Boot

**情景描述:** 开发者正在构建一个保险应用的后端服务，需要在一个`PolicyController`中添加一个新的GET请求接口，用于根据保单ID查询保单详情。

**与Continue的交互 (代码生成):**

1.  **初始代码上下文 (部分`PolicyController.java`):**
    ```java
    package com.example.insurance.controller;

    import com.example.insurance.dto.PolicyDto;
    import com.example.insurance.service.PolicyService;
    // import org.springframework.http.ResponseEntity; // Continue可能会建议添加
    // import org.springframework.web.bind.annotation.*; // Continue可能会建议添加

    @RestController
    @RequestMapping("/api/v1/policies")
    public class PolicyController {

        private final PolicyService policyService;

        public PolicyController(PolicyService policyService) {
            this.policyService = policyService;
        }

        // TODO: 添加根据保单ID查询保单详情的GET接口
    }
    ```

2.  **与Continue的交互:**
    开发者将光标置于 `// TODO:` 注释处，然后在Continue聊天框中输入：
    `/generate 请帮我创建一个Spring Boot的GET请求处理方法，路径为 "/{policyId}"。这个方法应该：
    1. 接收一个路径变量 `policyId` (String类型)。
    2. 调用 `policyService.findPolicyById(policyId)` 来获取保单对象 (假设返回类型为 `PolicyDto`)。
    3. 如果找到保单，返回 `ResponseEntity.ok(policyDto)`。
    4. 如果未找到保单 (例如，`policyService` 返回 `null` 或抛出自定义的 `PolicyNotFoundException`)，返回 `ResponseEntity.notFound().build()`。
    请包含必要的Spring注解，如 `@GetMapping` 和 `@PathVariable`，以及相关的import语句。`

3.  **预期Continue的输出/行为描述:**
    Continue应生成一个完整的Java方法代码块，并建议必要的import语句。生成的代码应类似如下：

    ```java
    // 提示可能需要添加以下import (如果IDE没有自动导入):
    // import com.example.insurance.dto.PolicyDto; // 假设PolicyDto已存在
    // import com.example.insurance.exception.PolicyNotFoundException; // 假设自定义异常已存在
    // import org.springframework.http.ResponseEntity;
    // import org.springframework.web.bind.annotation.GetMapping;
    // import org.springframework.web.bind.annotation.PathVariable;

    @GetMapping("/{policyId}")
    public ResponseEntity<PolicyDto> getPolicyById(@PathVariable String policyId) {
        try {
            PolicyDto policyDto = policyService.findPolicyById(policyId);
            if (policyDto != null) { // 假设 policyService 返回 null 表示未找到
                return ResponseEntity.ok(policyDto);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (PolicyNotFoundException ex) { // 或者根据提示处理 policyService 可能抛出的异常
            // 可以选择记录日志
            // logger.warn("Policy with ID {} not found", policyId, ex);
            return ResponseEntity.notFound().build();
        }
    }
    ```
    Continue可能会根据提示中关于 `PolicyNotFoundException` 的说明，优先生成包含 `try-catch` 块的版本。它还会确保方法签名、注解和返回类型符合Spring Boot REST Controller的最佳实践。

**Continue的助力:** 快速生成符合Spring Boot规范的Controller层样板代码，减少手动编写，提高开发效率，并帮助开发者思考异常处理逻辑（如`null`检查或捕获特定异常）。同时，它也能提示必要的注解和导入，避免遗漏。

---

### 案例二：Continue辅助构建MyBatis XML Mapper中的SQL查询语句

**技术栈:** Java, MyBatis, SQL (假设使用MySQL或PostgreSQL语法)

**情景描述:** 开发者正在为一个保险项目编写MyBatis的Mapper XML文件，需要构建一个SQL查询，用于根据客户ID (`customer_id`) 和保单生效日期 (`effective_date`) 查找所有在该日期之后生效的有效保单 (`status = 'ACTIVE'`)。

**与Continue的交互 (代码/SQL补全与建议):**

1.  **初始MyBatis XML上下文 (部分`PolicyMapper.xml`):**
    ```xml
    <mapper namespace="com.example.insurance.repository.PolicyMapper">
        <resultMap id="PolicyResultMap" type="com.example.insurance.model.Policy">
            <id property="policyId" column="policy_id"/>
            <result property="customerId" column="customer_id"/>
            <result property="policyNumber" column="policy_number"/>
            <result property="effectiveDate" column="effective_date"/>
            <result property="expiryDate" column="expiry_date"/>
            <result property="status" column="status"/>
        </resultMap>

        <select id="findActivePoliciesForCustomerAfterDate" resultMap="PolicyResultMap" parameterType="map">
            SELECT 
                policy_id, customer_id, policy_number, effective_date, expiry_date, status
            FROM 
                policies
            WHERE 
                customer_id = #{customerId,jdbcType=VARCHAR}
                AND status = 'ACTIVE'
                <!-- TODO: 添加生效日期在指定参数日期之后的条件 -->
        </select>
    </mapper>
    ```

2.  **与Continue的交互:**
    开发者将光标置于 `<!-- TODO: ... -->` 注释处，或直接删除该注释并开始输入。
    然后在Continue聊天框中提问（或依赖其上下文感知进行代码补全/建议）：
    `我需要在MyBatis的select语句的WHERE子句中添加一个条件：查询 effective_date (数据库列名) 大于参数 "inputDate" (类型为DATE) 的记录。请给出相应的MyBatis XML条件片段。`

3.  **预期Continue的输出/行为描述:**
    Continue应建议或生成类似以下的XML片段，用于插入到 `WHERE` 子句的末尾：

    ```xml
    AND effective_date > #{inputDate,jdbcType=DATE}
    ```
    如果开发者进一步询问如何处理 `inputDate` 可能为空的情况，Continue可能会建议使用动态SQL的 `<if>` 标签：
    `如果参数 "inputDate" 可能为空，并且为空时不应用此日期条件，该如何修改？`

    Continue可能会建议：
    ```xml
    <if test="inputDate != null">
        AND effective_date > #{inputDate,jdbcType=DATE}
    </if>
    ```
    它会解释 `parameterType="map"` 时，`inputDate` 是map中的一个键。

**Continue的助力:** 帮助开发者快速、准确地编写MyBatis XML中的SQL条件，特别是对于MyBatis特定语法（如`jdbcType`的指定、参数占位符格式）和动态SQL标签（如`<if>`），可以提供有效的提示和补全，减少查阅文档的时间和潜在的语法错误。

---

### 案例三：将Java 8的集合处理代码重构为Java 17的Stream API

**技术栈:** Java 8, Java 17

**情景描述:** 开发者有一段使用传统for循环和if条件处理保险索赔（`Claim`）对象列表的Java 8代码。目标是筛选出状态为“PENDING”且金额大于1000的索赔，并收集它们的ID。现在希望将其重构为使用Java 17的Stream API，以提高代码的简洁性和可读性。

**与Continue的交互 (代码重构/生成):**

1.  **初始Java 8代码:**
    ```java
    // 假设 Claim 类定义如下:
    // class Claim { 
    //     private String id; 
    //     private String status; 
    //     private double amount; 
    //     public Claim(String id, String status, double amount) { /* ... */ }
    //     public String getId() { return id; }
    //     public String getStatus() { return status; }
    //     public double getAmount() { return amount; }
    // }

    List<Claim> claims = getClaimsFromSomewhere(); // 模拟获取索赔列表
    List<String> highValuePendingClaimIds = new ArrayList<>();
    for (Claim claim : claims) {
        if ("PENDING".equals(claim.getStatus())) {
            if (claim.getAmount() > 1000) {
                highValuePendingClaimIds.add(claim.getId());
            }
        }
    }
    // highValuePendingClaimIds 包含结果
    ```

2.  **与Continue的交互:**
    开发者高亮显示整个for循环及其初始化 `highValuePendingClaimIds` 的代码块（从 `List<String> highValuePendingClaimIds = new ArrayList<>();` 到for循环结束）。
    在Continue聊天框中输入：
    `/edit 请将这段Java 8的for循环代码重构为使用Java 17的Stream API。目的是筛选出所有状态为 "PENDING" 并且金额 (amount) 大于 1000 的索赔 (Claim) 对象的ID (id)，并收集到 List<String> 中。`

3.  **预期Continue的输出/行为描述:**
    Continue应提供使用Stream API重构后的代码版本，可能会在diff视图中直接建议替换高亮的代码块。生成的代码应类似：

    ```java
    // import java.util.List; // 确保已导入
    // import java.util.stream.Collectors; // 确保已导入

    List<Claim> claims = getClaimsFromSomewhere(); // 模拟获取索赔列表
    List<String> highValuePendingClaimIds = claims.stream()
                                                 .filter(claim -> "PENDING".equals(claim.getStatus()) && claim.getAmount() > 1000)
                                                 .map(Claim::getId)
                                                 .collect(Collectors.toList());
    // highValuePendingClaimIds 包含结果
    ```
    Continue可能还会简要解释重构后的代码：说明 `stream()`开启流处理，`filter()`用于条件筛选，`map()`用于提取ID，`collect(Collectors.toList())`用于将结果收集到新的列表中。

**Continue的助力:** 帮助开发者学习和应用现代Java特性（如Stream API），将命令式代码转换为更简洁、更易读、更函数式的风格。这不仅提高了代码质量和可维护性，还能减少潜在的循环和条件判断错误。

---

### 案例四：生成包含JSR 303验证注解的Java POJO (保险客户信息)

**技术栈:** Java 17, JSR 303 Bean Validation (e.g., Hibernate Validator / jakarta.validation)

**情景描述:** 在保险项目的客户信息模块，开发者需要创建一个`CustomerProfile` POJO类，用于接收和验证客户注册信息。该类需要包含姓名、邮箱、电话号码和出生日期等字段，并对这些字段应用JSR 303 Bean Validation注解（如`@NotBlank`, `@Email`, `@Pattern`, `@Past`）。

**与Continue的交互 (代码生成):**

1.  **与Continue的交互:**
    在Continue聊天框中输入：
    `/generate 请创建一个Java POJO类名为 "CustomerProfile"，包名为 "com.example.insurance.dto"。此类应包含以下属性，并附带Jakarta Bean Validation (JSR 303) 注解：
    1.  `firstName` (String): 不能为空白 (`@NotBlank`)。
    2.  `lastName` (String): 不能为空白 (`@NotBlank`)。
    3.  `email` (String): 必须是有效的电子邮件格式 (`@Email`)且不能为空白 (`@NotBlank`)。
    4.  `phoneNumber` (String): 必须符合北美电话号码格式，例如 "+1 (123) 456-7890" (使用`@Pattern`，正则表达式应允许可选的+1和区号括号以及空格或破折号作为分隔符，例如 `regexp="^(\\+1\\s?)?(\\(\\d{3}\\)|\\d{3})[\\s.-]?\\d{3}[\\s.-]?\\d{4}$"`)，此字段可以为空，但如果提供则必须匹配模式。
    5.  `dateOfBirth` (java.time.LocalDate): 必须是过去的日期 (`@Past`)且不能为空 (`@NotNull`)。
    请同时生成所有属性的public getter和setter方法，一个默认的无参构造函数，以及一个包含所有字段的构造函数。确保导入所有必要的`jakarta.validation.constraints.*`注解。`

2.  **预期Continue的输出/行为描述:**
    Continue应生成一个完整的`CustomerProfile.java`类文件内容，类似如下：

    ```java
    package com.example.insurance.dto;

    import jakarta.validation.constraints.Email;
    import jakarta.validation.constraints.NotBlank;
    import jakarta.validation.constraints.NotNull;
    import jakarta.validation.constraints.Past;
    import jakarta.validation.constraints.Pattern;
    import java.time.LocalDate;

    public class CustomerProfile {

        @NotBlank(message = "First name cannot be blank.")
        private String firstName;

        @NotBlank(message = "Last name cannot be blank.")
        private String lastName;

        @NotBlank(message = "Email cannot be blank.")
        @Email(message = "Email should be valid.")
        private String email;

        // 允许为空，但如果提供则必须匹配模式
        @Pattern(regexp = "^(\\+1\\s?)?(\\(\\d{3}\\)|\\d{3})[\\s.-]?\\d{3}[\\s.-]?\\d{4}$", message = "Phone number format should be North American, e.g., +1 (123) 456-7890")
        private String phoneNumber;

        @NotNull(message = "Date of birth cannot be null.")
        @Past(message = "Date of birth must be in the past.")
        private LocalDate dateOfBirth;

        public CustomerProfile() {
        }

        public CustomerProfile(String firstName, String lastName, String email, String phoneNumber, LocalDate dateOfBirth) {
            this.firstName = firstName;
            this.lastName = lastName;
            this.email = email;
            this.phoneNumber = phoneNumber;
            this.dateOfBirth = dateOfBirth;
        }

        // Getters and Setters
        public String getFirstName() {
            return firstName;
        }

        public void setFirstName(String firstName) {
            this.firstName = firstName;
        }

        public String getLastName() {
            return lastName;
        }

        public void setLastName(String lastName) {
            this.lastName = lastName;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPhoneNumber() {
            return phoneNumber;
        }

        public void setPhoneNumber(String phoneNumber) {
            this.phoneNumber = phoneNumber;
        }

        public LocalDate getDateOfBirth() {
            return dateOfBirth;
        }

        public void setDateOfBirth(LocalDate dateOfBirth) {
            this.dateOfBirth = dateOfBirth;
        }
    }
    ```
    Continue会根据提示生成带有注解的字段、构造函数以及getter/setter。它会导入必要的 `jakarta.validation.constraints.*` 注解（如果用户使用的是较旧的Spring Boot版本，可能需要提示用户调整为 `javax.validation.constraints.*`）。

**Continue的助力:** 极大地加速了数据模型类（POJO/DTO）的创建过程，特别是当涉及到繁琐的注解（如JSR 303）和样板方法（getter/setter/constructor）时。能确保注解使用的正确性（包括复杂的正则表达式），减少因遗漏或拼写错误导致的验证问题，并帮助开发者快速构建符合数据校验规范的类。

---

# VS Code 安装指南

本指南将引导您完成在 Visual Studio Code (VS Code) 中安装 Continue 扩展的步骤。

1.  **在 Visual Studio Marketplace 中查找 Continue 扩展**:
    *   打开 VS Code。
    *   点击侧边栏的“扩展”图标（通常是四个方块，其中一个略微分开的图标）。
    *   在搜索框中输入 "Continue"。
    *   在搜索结果中找到名为 "Continue" 的扩展，其发布者通常为 "Continue Dev"。

2.  **安装扩展**:
    *   点击 "Continue" 扩展旁边的 "安装" (Install) 按钮。
    *   VS Code 将会自动下载并安装该扩展。安装完成后，"安装" 按钮会变为 "卸载" (Uninstall) 按钮。

3.  **定位 Continue 图标并优化布局**:
    *   安装成功后，您会在 VS Code 的活动栏（最左侧的工具栏）中看到一个新的 Continue 图标（通常是一个播放按钮或类似的符号）。
    *   为了获得更好的用户体验，我们建议将 Continue 视图移动到右侧边栏。默认情况下，Continue 的聊天界面会显示在左侧边栏。通过将其移动到右侧，您可以同时查看代码和与Continue聊天，而无需在它们之间来回切换。
        *   右键点击活动栏中的 Continue 图标。
        *   选择将其移动到右侧边栏的选项（具体措辞可能因VS Code版本而异，通常是类似 "Move to Right Sidebar" 或 "Move View to Right" 的选项）。

4.  **登录 Continue Hub 开始使用**:
    *   点击（现在位于右侧边栏的）Continue 图标，打开 Continue 聊天面板。
    *   通常，初次使用时，扩展会提示您登录 Continue Hub。
    *   按照提示完成登录/注册过程。登录后，您就可以开始使用 Continue 的各项功能了，例如与AI聊天、使用代码自动补全等。

完成以上步骤后，Continue 扩展就成功安装并基本配置完毕了。您可以开始探索它强大的AI辅助编程功能了！

---

# IntelliJ IDEA 安装指南

本指南将引导您完成在 IntelliJ IDEA (以及其他 JetBrains 系列 IDE，如 PyCharm, WebStorm, GoLand 等) 中安装 Continue 插件的步骤。

1.  **打开 IDE 设置/首选项**:
    *   在 IntelliJ IDEA 中，您可以通过以下方式打开设置：
        *   Windows/Linux: 使用快捷键 `Ctrl + Alt + S`。
        *   macOS: 使用快捷键 `Cmd + ,` (Command + Comma) 或通过菜单栏 `IntelliJ IDEA -> Preferences`。
    *   这将打开“设置”（Settings）或“首选项”（Preferences）对话框。

2.  **在 Marketplace 中查找 Continue 插件**:
    *   在“设置/首选项”对话框中，选择左侧的 "Plugins" (插件) 选项。
    *   确保您在 "Marketplace" (市场) 标签页下。
    *   在顶部的搜索框中输入 "Continue"。
    *   在搜索结果中找到名为 "Continue" 的插件，其发布者通常为 "Continue Dev"。

3.  **安装插件**:
    *   点击 "Continue" 插件旁边的 "Install" (安装) 按钮。
    *   IDE 将会自动下载并安装该插件。
    *   安装完成后，系统可能会提示您重启 IDE 以使更改生效。请点击 "Restart IDE" (重启 IDE)。

4.  **Continue 图标位置**:
    *   IDE 重启后，Continue 插件即安装完成。
    *   您会在 IDE 的右侧工具栏中看到一个新的 Continue 图标（通常是一个播放按钮或类似的符号）。

5.  **登录 Continue Hub 开始使用**:
    *   点击右侧工具栏中的 Continue 图标，打开 Continue 聊天面板。
    *   通常，初次使用时，插件会提示您登录 Continue Hub。
    *   按照提示完成登录/注册过程。登录后，您就可以开始使用 Continue 的各项功能了。

完成以上步骤后，Continue 插件就成功安装并基本配置完毕了。您可以开始在您喜爱的 JetBrains IDE 中享受AI辅助编程的便利了！

---

# 基本用法

安装并登录 Continue 后，您就可以开始体验其强大的AI辅助功能了。本节将介绍一些基本的使用方法。

1.  **打开 Continue 面板/侧边栏**:
    *   **VS Code**: 点击您在安装步骤中移动到右侧边栏的 Continue 图标，即可展开 Continue 的聊天和功能面板。
    *   **IntelliJ IDEA (及其他 JetBrains IDEs)**: 点击 IDE 右侧工具栏中的 Continue 图标，即可打开 Continue 工具窗口。

2.  **与 Continue 聊天**:
    *   打开 Continue 面板后，您会看到一个聊天输入框。
    *   您可以像与人聊天一样，用自然语言向 Continue 提问。例如：
        *   `你好，你能帮我做什么？`
        *   `解释一下 Python 中的 'yield' 关键字。`
        *   `我遇到了一个 JavaScript 错误：'TypeError: undefined is not a function'，这是什么原因？`
    *   Continue 会根据您选择的模型（见下文）来理解您的问题并给出回答或建议。

3.  **使用斜杠命令 (Slash Commands)**:
    Continue 提供了一些便捷的斜杠命令，可以直接在聊天输入框中使用，以执行特定任务。这些命令通常以 `/` 开头。
    *   **`/edit` (编辑代码)**:
        *   在您的代码编辑器中高亮一段您想要修改的代码。
        *   在 Continue 聊天输入框中输入 `/edit`，然后描述您想做的修改。例如：
            *   `/edit 将这个函数转换为异步函数，并使用 await 处理异步调用。`
            *   `/edit 为这段代码添加中文注释。`
            *   `/edit 优化这段循环的性能。`
        *   Continue 会尝试理解您的指令，并在差异视图 (diff view) 中展示修改建议，您可以选择接受或拒绝这些更改。
    *   **`/generate` (生成代码)**:
        *   如果您想在当前光标位置或特定位置生成新的代码片段，可以使用 `/generate`。
        *   例如，在聊天框输入：
            *   `/generate 一个 Python 函数，用于计算斐波那契数列。`
            *   `/generate 一个 React functional component，包含一个输入框和状态管理。`
    *   **其他常用命令**:
        *   `/clear`: 清除当前聊天历史。
        *   `/help`: 显示可用的斜杠命令列表和帮助信息。
        *   `/commit`: （实验性）帮助您根据当前的代码更改生成 Git commit 信息。

4.  **选择模型**:
    *   Continue 支持使用不同的大型语言模型 (LLM) 作为其AI引擎。不同的模型可能在代码理解、生成质量、响应速度和成本方面有所差异。
    *   您通常可以在 Continue 的设置或配置界面中选择或切换模型。具体操作方式可能略有不同，但通常会有一个下拉菜单或列表供您选择。
    *   一些常见的模型可能包括 OpenAI 的 GPT 系列 (如 GPT-4, GPT-3.5-turbo)、Anthropic 的 Claude 系列，或者一些开源模型。
    *   对于初学者，可以使用默认配置的模型开始。随着您对 Continue 更加熟悉，可以根据自己的需求和偏好探索不同的模型。

    **注意**: 某些模型可能需要您拥有相应的 API 密钥，并进行配置才能使用。本教程的下一节将详细介绍如何配置模型。

以上是 Continue 的一些基本用法。我们鼓励您多尝试与 Continue 互动，探索其更多功能，找到最适合您工作流程的使用方式。

---

# 接入和配置LLM模型

Continue 的强大之处在于其灵活性，允许您接入并配置各种大型语言模型 (LLM)。Continue 支持通过 `config.yaml` (推荐方式) 和 `config.json` (旧有方式) 两种文件格式进行配置。本节将详细介绍这两种方法。

## 使用 `config.yaml` (推荐)

`config.yaml` 是 Continue 当前推荐的配置文件格式，因其可读性更佳，并且能通过配合 `.env` 文件更安全地管理API密钥。

1.  **主要配置文件位置**:
    `config.yaml` 文件可以存在于两个位置：
    *   **全局配置**: `~/.continue/assistants/config.yaml` (Linux/macOS) 或 `%USERPROFILE%\.continue\assistants\config.yaml` (Windows)。此处的配置适用于您所有的项目。
    *   **工作区配置**: `.continue/assistants/config.yaml` (在您的项目根目录下)。此处的配置仅对当前工作区有效，并会覆盖全局配置中同名的模型定义。

2.  **模型定义**:
    在 `config.yaml` 文件中，模型定义在 `models:` 块下。每个模型通常包含以下关键字段：
    *   `name`: 您为该模型在IDE中显示的自定义名称，例如 "My GPT-4o" 或 "Local Llama3"。
    *   `provider`: 指定模型的提供者。常见的值有 `openai`, `ollama`, `anthropic`, `gemini`, `mistral` 等。
    *   `model`: 模型的具体ID，这取决于提供者。例如，对于 `openai`，可能是 `gpt-4o` 或 `gpt-3.5-turbo`；对于 `ollama`，可能是您本地运行的 `llama3` 或 `codellama`；对于 `anthropic`，可能是 `claude-3-opus-20240229`。
    *   `roles` (可选): 您可以为模型指定角色，如 `chat` (聊天), `edit` (编辑代码), `autocomplete` (自动补全)。如果未指定，模型通常可用于所有角色。

3.  **API密钥管理 (`config.yaml` 方式)**:
    许多商业模型需要 API 密钥才能访问。Continue 配合 `config.yaml` 提供了安全的方式来管理这些密钥。

    *   **推荐方法：使用 `.env` 文件和 `secrets` 对象**:
        1.  **创建 `.env` 文件**:
            在您的全局 Continue 目录 (`~/.continue/`) 或项目的工作区根目录下创建一个名为 `.env` 的文件。
        2.  **添加API密钥**:
            在 `.env` 文件中，按以下格式添加您的API密钥：
            ```env
            OPENAI_API_KEY=sk-your_actual_openai_api_key_here
            ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here
            GOOGLE_API_KEY=your_google_api_key_here
            ```
            **重要**: 将 `your_actual_..._key_here` 替换为您的真实API密钥。确保不要将包含真实密钥的 `.env` 文件提交到版本控制系统 (如 Git)。建议将 `.env` 加入到 `.gitignore` 文件中。

        3.  **在 `config.yaml` 中引用密钥**:
            使用 `secrets` 对象来引用 `.env` 文件中定义的密钥。
            ```yaml
            models:
              - name: "GPT-4o (OpenAI)"
                provider: openai
                model: gpt-4o
                apiKey: ${{ secrets.OPENAI_API_KEY }}

              - name: "Claude 3.5 Sonnet"
                provider: anthropic
                model: claude-3-5-sonnet-20240620
                apiKey: ${{ secrets.ANTHROPIC_API_KEY }}
            ```
            对于从 Continue Hub 引入的预定义模型配置，您可能在 `with:` 块中使用类似的方式提供密钥：
            ```yaml
            # Example for a model from Continue Hub that requires an API key
            # - hubModelId: openai/gpt-4
            #   with:
            #     OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
            ```

    *   **备选方法 (不推荐用于敏感密钥)**:
        对于某些特定提供商或自定义设置，API密钥可能需要作为请求头的一部分。例如，在 `requestOptions.headers` 中设置 `Authorization: Bearer YOUR_KEY`。但为了安全起见，强烈建议对敏感密钥使用上述的 `secrets` 方法。

4.  **特定提供商说明 (`config.yaml` 方式)**:
    *   **Ollama**:
        对于在本地运行的 Ollama 模型，通常不需要API密钥。您只需指定 `provider: ollama` 以及您在本地已拉取并运行的 `model` 名称。
        ```yaml
        models:
          - name: "Local Llama3"
            provider: ollama
            model: llama3 # 确保 'llama3' 模型已通过 'ollama pull llama3' 下载并在运行中
            # 对于Ollama，通常不需要 apiKey 字段
        ```
    *   **OpenAI, Anthropic, Gemini, Mistral 等**:
        这些云服务提供商通常都需要 API 密钥。请务必按照上述 `.env` 和 `secrets` 的方法进行配置。

5.  **示例 `config.yaml` 片段**:
    下面是一个简单的 `config.yaml` 示例，展示了如何定义一个 OpenAI 模型（使用 `.env` 文件中的密钥）和一个本地 Ollama 模型：

    ```yaml
    # 位于 ~/.continue/assistants/config.yaml 或 .continue/assistants/config.yaml

    models:
      - name: "GPT-4 Omni"
        provider: openai
        model: gpt-4o
        apiKey: ${{ secrets.OPENAI_API_KEY }} # 引用 .env 文件中的 OPENAI_API_KEY

      - name: "Local CodeLlama (7b)"
        provider: ollama
        model: codellama:7b # 确保此模型在您的Ollama服务中可用
        # Ollama通常不需要apiKey

      - name: "Claude 3.5 Sonnet"
        provider: anthropic
        model: claude-3-5-sonnet-20240620
        apiKey: ${{ secrets.ANTHROPIC_API_KEY }} # 引用 .env 文件中的 ANTHROPIC_API_KEY
    ```
    **请确保您的 `.env` 文件 (例如 `~/.continue/.env`) 包含相应的密钥**:
    ```env
    OPENAI_API_KEY=sk-your_openai_key
    ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
    ```

---

## 使用 `config.json`

虽然 Continue 的官方文档现在通常推荐使用 `config.yaml` 进行配置，但在某些情况下或在旧版本中，您可能会遇到或选择使用 `config.json` 文件来配置LLM模型。

1.  **文件位置**:
    `config.json` 文件通常位于以下位置之一：
    *   **全局配置**: `~/.continue/config.json` (Linux/macOS) 或 `%USERPROFILE%\.continue\config.json` (Windows)。
    *   **工作区配置**: `.continue/config.json` (在您的项目根目录下)。此处的配置会覆盖全局配置。

2.  **文件结构**:
    `config.json` 是一个标准的JSON文件。模型定义通常在一个名为 `"models"` 的顶层数组中。

3.  **`config.json` 中的关键模型属性**:
    在 `"models"` 数组中，每个模型对象通常包含以下属性：
    *   `"title"` (字符串): 在IDE中为该模型显示的名称。
    *   `"provider"` (字符串): LLM的提供商，例如 `"openai"`, `"ollama"`, `"anthropic"`, `"gemini"`。
    *   `"model"` (字符串): 具体的模型ID，例如 `"gpt-4o"`, `"claude-3-opus-20240229"`。对于 Ollama，您可以使用 `"AUTODETECT"` 来自动检测可用的本地模型，或者指定具体的模型名称如 `"llama3"`。
    *   `"apiKey"` (字符串, 可选): 访问模型所需的API密钥。
    *   `"apiBase"` (字符串, 可选): 对于需要自定义API端点的提供商（例如自托管的Ollama或兼容OpenAI API的服务），可以使用此字段指定基础URL。

4.  **`config.json` 中的API密钥处理**:
    *   在 `config.json` 中，API密钥通常以**直接字符串**的形式包含在模型定义的 `"apiKey"` 字段中。
    *   **安全提示**: 如果您的 `config.json` 文件包含敏感的API密钥，请务必妥善保护此文件，避免意外泄露（例如，不要将其提交到公共代码仓库）。虽然某些工具可能支持在JSON字符串中引用环境变量 (例如 `"$MY_API_KEY"`), 但在Continue的 `config.json` 中，直接写入密钥是文档中常见的方式。相比之下，`config.yaml` 配合 `.env` 文件和 `secrets` 对象提供了更安全的密钥管理机制。

5.  **示例 `config.json` 片段**:
    以下是如何在 `config.json` 中定义一个OpenAI模型和一个Ollama模型的示例：

    ```json
    {
      "models": [
        {
          "title": "GPT-4o (OpenAI - JSON)",
          "provider": "openai",
          "model": "gpt-4o",
          "apiKey": "sk-YOUR_OPENAI_API_KEY_HERE"
        },
        {
          "title": "Local Llama3 (Ollama - JSON)",
          "provider": "ollama",
          "model": "llama3"
        },
        {
          "title": "Ollama Autodetect (JSON)",
          "provider": "ollama",
          "model": "AUTODETECT"
        }
      ]
    }
    ```
    请记得将 `"sk-YOUR_OPENAI_API_KEY_HERE"` 替换为您的真实OpenAI API密钥。

6.  **`config.json` 中的其他配置**:
    除了 `"models"` 数组外，`config.json` 还可能包含其他顶层键，用于配置特定功能，例如：
    *   `"tabAutocompleteModel"`: 用于配置Tab键自动补全功能的特定模型。
    *   `"embeddingsProvider"`: 用于配置生成嵌入（embeddings）的模型。

    示例：
    ```json
    {
      "models": [
        // ... 您的模型定义 ...
      ],
      "tabAutocompleteModel": {
        "provider": "ollama",
        "model": "codellama:7b-instruct"
      },
      "embeddingsProvider": {
        "provider": "openai",
        "model": "text-embedding-ada-002"
      }
      // ... 其他配置 ...
    }
    ```

---

**总结与迁移建议**

目前，`config.yaml` 是 Continue 推荐的配置方式，因为它提供了更好的可读性和更安全的密钥管理。如果您之前使用的是 `config.json`，并希望迁移到 `config.yaml`，建议查阅 Continue 的官方文档。官方文档通常会提供最新的配置指南、支持的模型列表、提供商详情以及更高级的配置选项（如自定义提示模板、上下文提供者等），并且可能是获取迁移步骤的最佳来源。

通过以上配置方法，您可以灵活地接入和配置各种LLM模型，让 Continue 成为您更强大的编程助手。

---

# 总结

Continue 通过将强大的AI辅助功能直接集成到您的IDE中，为开发者提供了一种革新性的编码体验。它不仅仅是一个工具，更像是一个智能的编程伙伴，能够帮助您理解代码、生成新代码、进行重构，甚至辅助调试。

**使用 Continue 的主要优势包括：**

*   **提升生产力**: 通过自动化重复性任务、快速生成代码片段和提供即时解答，Continue 可以显著减少您的开发时间。
*   **无缝的AI集成**: 无需离开您的开发环境，即可享受大型语言模型带来的便利，使AI辅助更加自然和高效。
*   **改善代码质量**: Continue 可以帮助您编写更清晰、更优化的代码，并协助您遵循最佳实践。
*   **加速学习过程**: 对于学习新的编程语言、框架或库，Continue 可以提供宝贵的指导和即时反馈。

我们鼓励您积极探索 Continue 的各项功能，从聊天交互到代码编辑，再到使用不同的AI模型。Continue 的强大之处在于其灵活性和可定制性。花一些时间配置它，使其最适合您的个人工作流程和项目需求。

开始使用 Continue，让AI为您的编码工作赋能，开启更智能、更高效的开发之旅！
