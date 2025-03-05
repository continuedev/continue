---
title: secret 解析
description: secret 解析介绍
keywords: [secret, 解析]
sidebar_label: Resolution
---

# secret 解析

[用户或组织 secret](./secret-types.md) 应该基于用户想要在它们的组织和助手中分享来使用。

对于单独的用户和 [个人](../governance/pricing.md#个人) 组织， secret 解析使用下面的顺序：

1. 用户 [附加模型](../governance/pricing.md#附加模型) (如果订阅)
2. [用户 secret](../secrets/secret-types.md#用户-secret) (如果设置)
3. [免费试用](../governance/pricing.md#免费试用) (如果低于限制)

对于 [团队](../governance/pricing.md#团队) 和 [企业](../governance/pricing.md#企业) 组织， secret 解析使用下面的顺序：

1. 组织 [附加模型](../governance/pricing.md#附加模型) (如果订阅)
2. [组织 secret](../secrets/secret-types.md#组织-secret) (如果设置)
3. [用户 secret](../secrets/secret-types.md#用户-secret) (如果设置)
