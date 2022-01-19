# ![img](https://git.io/JLhnf) E2E-E Icons

This TypeScript program designed to automatically turn text in GitHub Markdown files into Minecraft's item icons, parsing their names or brackets.

For example:

| This string                           | Turns into this                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [Iron Ingot] [Anvil] [Triple Battery] | ![](https://git.io/JLjca 'Iron Ingot') ![](https://git.io/JLjcu 'Anvil') ![](https://git.io/JP66y 'Triple Battery') |

## Other examples

Note that we can mark different `mods` or `metas` for same names

<table>
<tr><td>
<strong>Before iconification:</strong>
</td><td>
<strong>After iconification:</strong>
</td></tr>
<td>

[Amber] (Biomes O' Plenty)  
[Lens] (AA)  
[Futura Block] (5)  

---

[Basalt] (advancedrocketry)  
[Basalt] (Chisel)  
[Basalt] (EM)  

</td>
<td>

![](https://git.io/Jw3pq 'Amber')  
![](https://git.io/JLhj8 'Lens')  
![](https://git.io/JLjsJ 'Futura Block')  

---

![](https://git.io/JLjsf 'Basalt Sediment')  
![](https://git.io/JP66S 'Basalt')  
![](https://git.io/JLjnZ 'Basalt')  

</td>
</tr>
</table>
